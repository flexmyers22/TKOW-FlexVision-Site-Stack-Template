'use client'

import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  BarChart3,
  BookOpen,
  Bot,
  Box,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  FileCode2,
  FilePlus2,
  Gauge,
  KeyRound,
  PiggyBank,
  Menu,
  Mic,
  PanelLeft,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import {
  cancelJob,
  createGeneration,
  EngineeringApiError,
  getApiConfiguration,
  getArtifactDownload,
  getDocumentStatus,
  getJob,
  listLibrary,
  retryJob,
  sendChat,
  uploadDocument,
  type Citation,
  type LibraryDocument,
  type ChatResponse,
  type GenerationJob,
} from '@/lib/engineering-api'
import { CHAT_MODELS, DEFAULT_CHAT_MODEL, type ChatModelId } from '@/lib/chat-models'
import { WORKFLOW_PAGES, type WorkflowPage } from '@/lib/credential-pages'
import { PIGGY_MAX_CENTS, type SavingsEntry, type WorkflowEvent } from '@/lib/piggybank-ledger'
import { formatCents, piggybankUpdate } from '@/lib/piggybank-update'

type Mode = 'Answer' | 'Draft BOM' | 'Generate Code' | 'Request CAD'
type Section = 'Engineering chat' | 'Library' | 'Parts & BOM' | 'CAD queue' | 'MATLAB' | 'Blender' | 'Credential' | 'Piggybank' | 'Analytics'
type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  citations?: Citation[]
  assumptions?: string[]
  unresolved?: string[]
  traceId?: string
  modelLabel?: string
}
type SourceFile = {
  documentId: string
  revisionId: string
  filename: string
  status: string
  progress?: number
  error?: string
}
type TrackedJob = GenerationJob & { kind: 'bom' | 'code' | 'cad'; createdAt: number }

const MAX_FILE_SIZE = 25 * 1024 * 1024
const ACCEPTED_EXTENSIONS = new Set(['pdf', 'docx', 'csv', 'xlsx', 'txt', 'md', 'json'])
const suggestions = [
  'Create a BOM from an approved drawing',
  'What evidence defines this equipment’s operating envelope?',
  'Draft a Python test harness from an approved interface',
]
const modes: Mode[] = ['Answer', 'Draft BOM', 'Generate Code', 'Request CAD']
const sections: { label: Section; icon: typeof Bot }[] = [
  { label: 'Engineering chat', icon: Bot },
  { label: 'Library', icon: BookOpen },
  { label: 'Parts & BOM', icon: FileCode2 },
  { label: 'CAD queue', icon: Gauge },
  { label: 'MATLAB', icon: Camera },
  { label: 'Blender', icon: Box },
  { label: 'Credential', icon: KeyRound },
  { label: 'Piggybank', icon: PiggyBank },
  { label: 'Analytics', icon: BarChart3 },
]

type CredentialAttachment = {
  file_id: string
  base_id: string
  filename: string
  size: number
  page: WorkflowPage | null
}
type MatlabBox = { area_px: number; centroid_xy: number[]; bbox_xywh: number[] }
type BlenderPackageView = {
  part_count: number
  unresolved_count: number
  warning?: string
  parts: { name: string; units: string; status: string; size: string }[]
  unresolved: { name: string; reason: string }[]
}
type MatlabResult = {
  width: number
  height: number
  threshold: number
  regions?: (MatlabBox & { id: string })[]
  tracks?: (MatlabBox & { track_id: string; missed: number })[]
}


function createId() {
  return globalThis.crypto.randomUUID()
}

function errorText(error: unknown) {
  if (error instanceof EngineeringApiError) {
    return `${error.message}${error.code ? ` (${error.code})` : ''}${error.traceId ? ` · Trace ${error.traceId}` : ''}`
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred.'
}

function terminalJob(state: string) {
  return ['completed', 'succeeded', 'failed', 'cancelled', 'blocked', 'ready', 'review_required', 'approved'].includes(state.toLowerCase())
}

function terminalDocument(status: string) {
  return ['ready', 'failed', 'quarantined', 'revoked', 'superseded'].includes(status.toLowerCase())
}

function documentState(status: { status?: string; state?: string }) {
  const value = status.status ?? status.state
  if (!value) throw new Error('The document status response did not include a status or state.')
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasValidChatResponse(value: unknown): value is ChatResponse {
  if (!isRecord(value)
    || typeof value.answer !== 'string'
    || typeof value.trace_id !== 'string'
    || !Array.isArray(value.citations)
    || !Array.isArray(value.assumptions)
    || !Array.isArray(value.unresolved)) return false
  return value.citations.every((item) =>
    isRecord(item)
    && typeof item.document_id === 'string'
    && typeof item.revision_id === 'string'
    && typeof item.chunk_id === 'string'
    && typeof item.source_hash === 'string'
    && isRecord(item.locator),
  )
}

function citationLocator(citation: Citation) {
  const { page, section, sheet, range } = citation.locator
  return [section, page ? `p. ${page}` : null, sheet, range].filter(Boolean).join(' · ') || 'Locator not provided'
}

export default function Page() {
  const configuration = getApiConfiguration()
  const [projectId, setProjectId] = useState(configuration.projectId)
  const [section, setSection] = useState<Section>('Engineering chat')
  const [mode, setMode] = useState<Mode>('Answer')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string>()
  const [sources, setSources] = useState<SourceFile[]>([])
  const [libraryDocuments, setLibraryDocuments] = useState<LibraryDocument[]>([])
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [jobs, setJobs] = useState<TrackedJob[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [showSources, setShowSources] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [listening, setListening] = useState(false)
  const [refreshingStatusId, setRefreshingStatusId] = useState('')
  const [category, setCategory] = useState('engineering')
  const [cadFormats, setCadFormats] = useState<string[]>(['STEP', 'STL'])
  const [model, setModel] = useState<ChatModelId>(DEFAULT_CHAT_MODEL)
  const [onshapeConnected, setOnshapeConnected] = useState(false)
  const [matlabConnected, setMatlabConnected] = useState(false)
  const [blenderConnected, setBlenderConnected] = useState(false)
  const [blenderMessage, setBlenderMessage] = useState('Checking Blender MCP.')
  const [blenderBusy, setBlenderBusy] = useState(false)
  const [blenderBuild, setBlenderBuild] = useState('')
  const [blenderPackage, setBlenderPackage] = useState<BlenderPackageView | null>(null)
  const [matlabMessage, setMatlabMessage] = useState('Checking the MATLAB vision service.')
  const [matlabBusy, setMatlabBusy] = useState(false)
  const [matlabLive, setMatlabLive] = useState(false)
  const [matlabResult, setMatlabResult] = useState<MatlabResult | null>(null)
  const matlabVideoRef = useRef<HTMLVideoElement>(null)
  const matlabSessionRef = useRef(createId())
  const matlabLiveRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [voiceNote, setVoiceNote] = useState('')
  const [credentialInput, setCredentialInput] = useState('')
  const [credentialKey, setCredentialKey] = useState('')
  const [credentialBaseId, setCredentialBaseId] = useState('')
  const [credentialFiles, setCredentialFiles] = useState<CredentialAttachment[]>([])
  const [workflowFiles, setWorkflowFiles] = useState<CredentialAttachment[]>([])
  const credentialFileRef = useRef<HTMLInputElement>(null)
  const [credentialBusy, setCredentialBusy] = useState(false)
  const [credentialCopied, setCredentialCopied] = useState(false)
  const credentialFieldRef = useRef<HTMLInputElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const [keypadDigits, setKeypadDigits] = useState('')
  const [keypadBusy, setKeypadBusy] = useState(false)
  const [keypadMessage, setKeypadMessage] = useState('')
  const [ledgerEntries, setLedgerEntries] = useState<SavingsEntry[]>([])
  const [ledgerEvents, setLedgerEvents] = useState<WorkflowEvent[]>([])
  const keypadLock = useRef(false)

  const configured = Boolean(projectId.trim())

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('onshape') === 'error') {
      setError('Onshape FeatureScript sign-in did not finish. Use Connect Onshape and try again.')
    }
    void fetch('/v1/onshape/status')
      .then((response) => response.json())
      .then((status: { connected?: boolean }) => setOnshapeConnected(status.connected === true))
      .catch(() => setOnshapeConnected(false))
    void fetch('/v1/matlab/status')
      .then((response) => response.json())
      .then((status: { connected?: boolean; message?: string }) => {
        setMatlabConnected(status.connected === true)
        if (status.message) setMatlabMessage(status.message)
      })
      .catch(() => {
        setMatlabConnected(false)
        setMatlabMessage('MATLAB status could not be read.')
      })
    void fetch('/v1/blender/status')
      .then((response) => response.json())
      .then((status: { connected?: boolean; message?: string }) => {
        setBlenderConnected(status.connected === true)
        if (status.message) setBlenderMessage(status.message)
      })
      .catch(() => {
        setBlenderConnected(false)
        setBlenderMessage('Blender status could not be read.')
      })
    void fetch('/v1/blender/package')
      .then((response) => response.json())
      .then((payload: { package?: BlenderPackageView | null }) => setBlenderPackage(payload.package ?? null))
      .catch(() => setBlenderPackage(null))
    void listLibrary()
      .then((library) => setLibraryDocuments(library.documents))
      .catch((reason: unknown) => setError(errorText(reason)))
  }, [])

  useEffect(() => {
    if (section === 'Credential') return
    void fetch(`/v1/credentials/workflow?page=${encodeURIComponent(section)}`)
      .then((response) => response.json())
      .then((payload: { files?: CredentialAttachment[] }) => setWorkflowFiles(payload.files ?? []))
      .catch(() => setWorkflowFiles([]))
  }, [section])

  useEffect(() => {
    if (section !== 'Piggybank') return
    void fetch('/v1/piggybank/ledger')
      .then((response) => response.json())
      .then((payload: { entries?: SavingsEntry[]; events?: WorkflowEvent[] }) => {
        if (Array.isArray(payload.entries)) setLedgerEntries(payload.entries)
        if (Array.isArray(payload.events)) setLedgerEvents(payload.events)
      })
      .catch(() => setKeypadMessage('The savings ledger could not be read.'))
  }, [section])
  const citedSources = useMemo(() => {
    const citations = messages.flatMap((message) => message.citations ?? [])
    return citations.filter((citation, index) =>
      citations.findIndex((candidate) => candidate.revision_id === citation.revision_id) === index,
    )
  }, [messages])
  const activeJobs = jobs.filter((job) => !terminalJob(job.state))

  function beginNewConversation() {
    setMessages([])
    setConversationId(undefined)
    setError('')
    setSection('Engineering chat')
    setMobileNavOpen(false)
  }

  async function trackJob(jobId: string) {
    const delays = [1200, 1800, 2700, 4000, 5000]
    for (let attempt = 0; attempt < 18; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delays[Math.min(attempt, delays.length - 1)]))
      const current = await getJob(jobId)
      setJobs((existing) => existing.map((job) => job.job_id === jobId ? { ...job, ...current, job_id: current.job_id ?? job.job_id } : job))
      if (terminalJob(current.state)) return
    }
  }

  async function submitMessage(text = input) {
    const content = text.trim()
    if (!content || busy) return
    if (mode === 'Request CAD' && cadFormats.length === 0) {
      setError('Select at least one requested CAD export format.')
      return
    }
    if (!configured) {
      setError('Configure the API URL and project ID before sending a request.')
      return
    }

    const selectedModel = CHAT_MODELS.find((item) => item.id === model)
    const userMessage: ChatMessage = { id: createId(), role: 'user', text: content, modelLabel: selectedModel?.label ?? model }
    setMessages((existing) => [...existing, userMessage])
    setInput('')
    setBusy(true)
    setError('')

    try {
      if (mode === 'Answer') {
        const result = await sendChat(projectId.trim(), content, selectedSourceIds, conversationId, model)
        if (!hasValidChatResponse(result)) {
          throw new Error('The chat API returned an invalid response. Check the backend response against Chat_Response.example.json.')
        }
        if (result.conversation_id) setConversationId(result.conversation_id)
        setMessages((existing) => [...existing, {
          id: createId(),
          role: 'assistant',
          text: result.answer,
          citations: result.citations,
          assumptions: result.assumptions ?? [],
          unresolved: result.unresolved ?? [],
          traceId: result.trace_id,
        }])
      } else {
        const kind = mode === 'Draft BOM' ? 'bom' : mode === 'Generate Code' ? 'code' : 'cad'
        const outputFormats = kind === 'bom' ? ['csv', 'json'] : kind === 'code' ? ['txt'] : cadFormats
        const created = await createGeneration(projectId.trim(), kind, content, selectedSourceIds, outputFormats)
        const tracked: TrackedJob = { ...created, kind, createdAt: Date.now() }
        setJobs((existing) => [tracked, ...existing.filter((job) => job.job_id !== created.job_id)])
        const missingInputs = created.missing_inputs?.length ? ` Missing inputs: ${created.missing_inputs.join(', ')}.` : ''
        setMessages((existing) => [...existing, {
          id: createId(),
          role: 'assistant',
          text: `${mode} request queued. Job ${created.job_id} is ${created.state}.${missingInputs} A downloadable artifact will appear only after the backend reports a completed artifact.`,
        }])
        void trackJob(created.job_id).catch((pollError: unknown) => setError(`Job status could not be refreshed: ${errorText(pollError)}`))
      }
    } catch (requestError) {
      setError(errorText(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload(file?: File) {
    if (!file) return
    if (!configured) {
      setError('Configure the API URL and project ID before uploading evidence.')
      return
    }
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!ACCEPTED_EXTENSIONS.has(extension)) {
      setError('Unsupported file type. Upload PDF, DOCX, CSV, XLSX, TXT, MD, or JSON.')
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('Files must be 25 MiB or smaller.')
      return
    }

    setUploading(true)
    setError('')
    setSources((existing) => [{
      documentId: '',
      revisionId: '',
      filename: file.name,
      status: 'Uploading',
    }, ...existing])

    try {
      const uploaded = await uploadDocument(file, projectId.trim(), category)
      setSources((existing) => existing.map((source) => source.filename === file.name && !source.documentId
        ? { ...source, documentId: uploaded.document_id, revisionId: uploaded.revision_id, status: 'Processing' }
        : source))

      for (let attempt = 0; attempt < 30; attempt += 1) {
        const status = await getDocumentStatus(uploaded.document_id)
        const statusName = documentState(status)
        const normalizedStatus = statusName.toLowerCase()
        setSources((existing) => existing.map((source) => source.documentId === uploaded.document_id
          ? { ...source, status: statusName, progress: status.progress, error: status.error }
          : source))
        if (normalizedStatus === 'ready') {
          setSelectedSourceIds((existing) => existing.includes(uploaded.revision_id) ? existing : [...existing, uploaded.revision_id])
          return
        }
        if (['failed', 'quarantined', 'revoked', 'superseded'].includes(normalizedStatus)) {
          setError(status.error || `Ingestion reported ${statusName} for ${file.name}. Review the reason before retrying or using this revision.`)
          return
        }
        await new Promise((resolve) => window.setTimeout(resolve, 2000))
      }
      setError(`Upload completed, but processing is still in progress for ${file.name}. Its status remains visible in the library.`)
    } catch (uploadError) {
      setSources((existing) => existing.map((source) => source.filename === file.name && !source.documentId
        ? { ...source, status: 'Failed', error: errorText(uploadError) }
        : source))
      setError(errorText(uploadError))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function refreshDocument(source: SourceFile) {
    if (!source.documentId) return
    setRefreshingStatusId(source.documentId)
    setError('')
    try {
      const status = await getDocumentStatus(source.documentId)
      const statusName = documentState(status)
      setSources((existing) => existing.map((item) => item.documentId === source.documentId
        ? { ...item, status: statusName, progress: status.progress, error: status.error }
        : item))
      if (statusName.toLowerCase() === 'ready') {
        setSelectedSourceIds((existing) => existing.includes(source.revisionId) ? existing : [...existing, source.revisionId])
      } else if (['failed', 'quarantined', 'revoked', 'superseded'].includes(statusName.toLowerCase()) && status.error) {
        setError(status.error)
      }
    } catch (statusError) {
      setError(errorText(statusError))
    } finally {
      setRefreshingStatusId('')
    }
  }

  async function refreshJob(job: TrackedJob) {
    setRefreshingStatusId(job.job_id)
    setError('')
    try {
      const status = await getJob(job.job_id)
      setJobs((existing) => existing.map((item) => item.job_id === job.job_id
        ? { ...item, ...status, job_id: status.job_id ?? item.job_id }
        : item))
    } catch (statusError) {
      setError(errorText(statusError))
    } finally {
      setRefreshingStatusId('')
    }
  }

  async function handleJobAction(job: TrackedJob, action: 'cancel' | 'retry') {
    if (job.version === undefined) {
      setError('The backend has not returned the job version required for this action. Refresh job status and try again.')
      return
    }
    setError('')
    try {
      const updated = action === 'cancel'
        ? await cancelJob(job.job_id, job.version)
        : await retryJob(job.job_id, job.version)
      const updatedJobId = updated.job_id ?? job.job_id
      setJobs((existing) => action === 'retry'
        ? [{ ...job, ...updated, job_id: updatedJobId, createdAt: Date.now() }, ...existing]
        : existing.map((current) => current.job_id === job.job_id ? { ...current, ...updated, job_id: updated.job_id ?? current.job_id } : current))
      if (action === 'retry') {
        void trackJob(updatedJobId).catch((pollError: unknown) => setError(`Job status could not be refreshed: ${errorText(pollError)}`))
      }
    } catch (actionError) {
      setError(errorText(actionError))
    }
  }

  async function downloadArtifact(artifactId: string) {
    try {
      const download = await getArtifactDownload(artifactId)
      window.open(download.download_url, '_blank', 'noopener,noreferrer')
    } catch (downloadError) {
      setError(errorText(downloadError))
    }
  }

  async function sendMicrophoneToFireflies(blob: Blob) {
    setVoiceNote('Sending the microphone recording to Fireflies.')
    setError('')
    try {
      const form = new FormData()
      form.append('audio', blob, 'microphone.webm')
      const response = await fetch('/v1/meetings/audio', { method: 'POST', body: form })
      const payload = await response.json() as { message?: string; error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message || 'Fireflies did not accept the microphone recording.')
      setVoiceNote(payload.message || 'Fireflies has the recording. The brief will arrive by email.')
    } catch (uploadError) {
      setVoiceNote('')
      setError(errorText(uploadError))
    }
  }

  async function toggleVoiceInput() {
    if (listening) {
      recorderRef.current?.stop()
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('This browser cannot record microphone audio for Fireflies. You can still type your request.')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('Microphone permission was blocked. Allow the microphone for this site, then record again.')
      return
    }
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find((type) => MediaRecorder.isTypeSupported(type))
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    const chunks: Blob[] = []
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data)
    }
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop())
      setListening(false)
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })
      void sendMicrophoneToFireflies(blob)
    }
    recorderRef.current = recorder
    setError('')
    setVoiceNote('Recording for Fireflies. Select the microphone again to send it.')
    setListening(true)
    recorder.start()
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.keyCode !== 229) {
      event.preventDefault()
      void submitMessage()
    }
  }

  function renderChat() {
    return (
      <div className="flex flex-1 flex-col px-5 py-7 lg:px-12 xl:px-20">
        <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col">
          {messages.length === 0 && (
            <div className="mb-8 flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Bot className="size-5" /></div>
              <div>
                <h2 className="text-lg font-semibold">What are we engineering today?</h2>
                <p className="text-sm text-muted-foreground">Ask about permitted project evidence, or start a separate BOM, code, or CAD job.</p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-5">
            {messages.map((message) => (
              <article key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                <div className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border border-border bg-card'}`}>
                  {message.role === 'assistant' && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">TKOW assistant</p>}
                  {message.role === 'user' && message.modelLabel && <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary-foreground/80">{message.modelLabel}</p>}
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-4 border-t border-border/70 pt-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cited evidence</p>
                      <div className="flex flex-col gap-2">
                        {message.citations.map((citation) => (
                          <div key={`${citation.revision_id}-${citation.chunk_id}`} className="rounded-lg bg-muted px-3 py-2 text-[11px] leading-5">
                            <span className="flex items-center gap-1.5 font-medium text-foreground"><Check className="size-3 text-emerald-400" />Revision {citation.revision_id}</span>
                            <span className="block text-muted-foreground">{citationLocator(citation)} · Chunk {citation.chunk_id}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {Boolean(message.assumptions?.length) && <EvidenceList title="Assumptions" items={message.assumptions ?? []} />}
                  {Boolean(message.unresolved?.length) && <EvidenceList title="Unresolved inputs" items={message.unresolved ?? []} />}
                  {message.traceId && <p className="mt-3 text-[10px] text-muted-foreground">Trace ID: {message.traceId}</p>}
                </div>
              </article>
            ))}
          </div>

          {busy && <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground" role="status"><span className="flex gap-1"><i className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-.2s]" /><i className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-.1s]" /><i className="size-1.5 animate-bounce rounded-full bg-primary" /></span>{mode === 'Answer' ? 'Checking project evidence…' : 'Submitting generation request…'}</div>}

          {messages.length === 0 && (
            <div className="mt-auto grid gap-2 pt-10 sm:grid-cols-3">
              {suggestions.map((suggestion) => <button key={suggestion} onClick={() => void submitMessage(suggestion)} disabled={busy} className="rounded-xl border border-border bg-card px-3 py-3 text-left text-xs leading-5 text-muted-foreground transition hover:border-primary/50 hover:bg-primary/5 hover:text-foreground disabled:opacity-50">{suggestion}</button>)}
            </div>
          )}

          <div className="mt-8">
            <form onSubmit={(event: FormEvent) => { event.preventDefault(); void submitMessage() }} className={`rounded-2xl border bg-card p-2 shadow-2xl shadow-black/5 transition ${listening ? 'border-primary ring-4 ring-primary/10' : 'border-border'}`}>
              <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleComposerKeyDown} placeholder={mode === 'Answer' ? 'Ask an engineering question…' : `Describe the ${mode === 'Draft BOM' ? 'BOM' : mode === 'Generate Code' ? 'code' : 'CAD'} request…`} className="min-h-16 w-full resize-y bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground" aria-label="Engineering request" />
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="grid size-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Attach engineering document"><Upload className="size-4" /></button>
                  <select value={category} onChange={(event) => setCategory(event.target.value)} className="max-w-32 rounded-lg border border-border bg-muted px-2 py-2 text-xs text-muted-foreground outline-none" aria-label="Evidence category">
                    <option value="engineering">Engineering</option><option value="datasheet">Datasheet</option><option value="drawing">Drawing</option><option value="bom">BOM</option><option value="test_record">Test record</option>
                  </select>
                  <button type="button" onClick={() => void toggleVoiceInput()} className={`grid size-9 place-items-center rounded-lg transition ${listening ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label={listening ? 'Stop microphone and send to Fireflies' : 'Record microphone audio for Fireflies'}>{listening ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}</button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">Model
                    <select value={model} onChange={(event) => setModel(event.target.value as ChatModelId)} className="rounded-lg border border-border bg-muted px-2 py-2 text-xs text-foreground outline-none" aria-label="Chat model">
                      {CHAT_MODELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <select value={mode} onChange={(event) => setMode(event.target.value as Mode)} className="rounded-lg border border-border bg-muted px-2 py-2 text-xs outline-none" aria-label="Task mode">
                    {modes.map((item) => <option key={item}>{item}</option>)}
                  </select>
                  <button type="submit" disabled={!input.trim() || busy} className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Send request"><ArrowUp className="size-4" /></button>
                </div>
              </div>
              {mode === 'Request CAD' && <fieldset className="mt-2 border-t border-border/70 px-2 pt-2"><legend className="px-1 text-[10px] text-muted-foreground">Requested export formats</legend><div className="flex gap-4 text-xs text-muted-foreground">{['STEP', 'STL'].map((format) => <label key={format} className="flex items-center gap-2"><input type="checkbox" checked={cadFormats.includes(format)} onChange={(event) => setCadFormats((current) => event.target.checked ? [...current, format] : current.filter((value) => value !== format))} />{format}</label>)}</div></fieldset>}
            </form>
            {voiceNote && <p className="mt-2 text-center text-[10px] text-emerald-300">{voiceNote}</p>}
            <p className="mt-2 text-center text-[10px] text-muted-foreground">Verify critical dimensions, units, and revisions before release. Generated drafts are not approvals. Microphone audio is sent to Fireflies and is not kept on this site.</p>
          </div>
        </div>
      </div>
    )
  }

  function renderLibrary() {
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">Evidence library</h2><p className="mt-1 text-sm text-muted-foreground">Initial library from the engineering documents on this machine, including documents added after the first index. Session uploads stay listed below it.</p></div>
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50"><Upload className="size-4" /> Add evidence</button>
        </div>
        {libraryDocuments.filter((document) => document.searchable).length === 0 ? <EmptyState title="Initial library is empty" detail="Text, Markdown, CSV, JSON, DOCX, and Excel files under Engineering Docs - Copy are indexed for chat, along with the text inside the Sites packages. Credential files are skipped." /> : (
          <div className="mb-8 max-h-[32rem] overflow-y-auto rounded-xl border border-border">
            {libraryDocuments.filter((document) => document.searchable).map((document) => (
              <div key={document.document_id} className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card p-4 last:border-b-0">
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-primary"><BookOpen className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{document.title}</p>
                  <p className="mt-1 truncate text-[10px] text-muted-foreground">{document.path}</p>
                </div>
                <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300">Ready</span>
                <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={selectedSourceIds.includes(document.revision_id)} onChange={(event) => setSelectedSourceIds((current) => event.target.checked ? [...current, document.revision_id] : current.filter((id) => id !== document.revision_id))} />Use in chat</label>
              </div>
            ))}
          </div>
        )}
        {sources.length === 0 ? <EmptyState title="No session uploads yet" detail="Upload an approved engineering source. It becomes selectable for chat after ingestion reports Ready." /> : (
          <div className="overflow-hidden rounded-xl border border-border">
            {sources.map((source, index) => (
              <div key={`${source.documentId || source.filename}-${index}`} className="flex flex-wrap items-center gap-3 border-b border-border/70 bg-card p-4 last:border-b-0">
                <div className="grid size-9 place-items-center rounded-lg bg-muted text-primary"><FilePlus2 className="size-4" /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{source.filename}</p>
                  <p className="mt-1 break-all text-[10px] text-muted-foreground">{source.revisionId || source.status}</p>
                  {source.error && <p className="mt-1 text-[10px] text-red-300">{source.error}</p>}
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${source.status.toLowerCase() === 'ready' ? 'bg-emerald-400/10 text-emerald-300' : source.status.toLowerCase() === 'failed' ? 'bg-red-400/10 text-red-300' : 'bg-muted text-muted-foreground'}`}>{source.status}{typeof source.progress === 'number' ? ` · ${source.progress}%` : ''}</span>
                {source.revisionId && <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={selectedSourceIds.includes(source.revisionId)} disabled={source.status.toLowerCase() !== 'ready'} onChange={(event) => setSelectedSourceIds((current) => event.target.checked ? [...current, source.revisionId] : current.filter((id) => id !== source.revisionId))} />Use in chat</label>}
                {source.documentId && !terminalDocument(source.status) && <button onClick={() => void refreshDocument(source)} disabled={refreshingStatusId === source.documentId} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">{refreshingStatusId === source.documentId ? 'Checking…' : 'Refresh status'}</button>}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderJobs(kind?: TrackedJob['kind']) {
    const visibleJobs = kind ? jobs.filter((job) => job.kind === kind) : jobs
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6"><h2 className="text-xl font-semibold">{kind === 'bom' ? 'Parts & BOM' : kind === 'cad' ? 'CAD queue' : 'Generation jobs'}</h2><p className="mt-1 text-sm text-muted-foreground">{kind === 'bom' ? 'Inventory scan uses NFC Tools for Desktop on this machine. Job state stays listed below.' : 'Job state and artifact links reported by the backend.'}</p></div>
        {kind === 'bom' && (
          <article className="mb-6 rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Inventory scan</p>
            <h3 className="mt-1 text-sm font-semibold">NFC Tools for Desktop</h3>
            <p className="mt-2 text-sm text-muted-foreground">Wakdev’s desktop app is the designated reader for this inventory scan. It needs an NFC reader and a compatible chip. The supplied package is the app readme and license notices, so this page cannot read a chip or import a scan yet.</p>
            <p className="mt-2 text-xs text-muted-foreground">Communication record: Computer engineering/AI_Chat_NFC_Phone_Sticker_Band.md. Reader help: https://support.wakdev.com/</p>
          </article>
        )}
        {visibleJobs.length === 0 ? <EmptyState title="No jobs in this session" detail="Create a BOM, code, or CAD request from Engineering chat. Existing jobs require a list-jobs endpoint, which is not in the current API contract." actionLabel="Start a request" onAction={() => { setSection('Engineering chat'); setMode(kind === 'bom' ? 'Draft BOM' : kind === 'cad' ? 'Request CAD' : 'Generate Code') }} /> : (
          <div className="flex flex-col gap-3">
            {visibleJobs.map((job) => (
              <article key={`${job.job_id}-${job.createdAt}`} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-sm font-semibold">{job.kind === 'bom' ? 'BOM draft' : job.kind === 'code' ? 'Code generation' : 'CAD request'}</p><p className="mt-1 break-all text-[10px] text-muted-foreground">Job {job.job_id}</p></div>
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase text-primary">{job.state}{job.stage ? ` · ${job.stage}` : ''}</span>
                </div>
                {typeof job.progress === 'number' && <div className="mt-4"><div className="mb-1 flex justify-between text-[10px] text-muted-foreground"><span>Progress</span><span>{job.progress}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, Math.max(0, job.progress))}%` }} /></div></div>}
                {job.error_code && <p className="mt-3 text-xs text-red-300">Backend error: {job.error_code}</p>}
                {Boolean(job.missing_inputs?.length) && <EvidenceList title="Missing inputs" items={job.missing_inputs ?? []} />}
                {!terminalJob(job.state) && <button onClick={() => void refreshJob(job)} disabled={refreshingStatusId === job.job_id} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50">{refreshingStatusId === job.job_id ? 'Checking…' : 'Refresh status'}</button>}
                {Boolean(job.artifact_ids?.length) && <div className="mt-4 flex flex-wrap gap-2">{job.artifact_ids?.map((artifactId) => <button key={artifactId} onClick={() => void downloadArtifact(artifactId)} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><ArrowDownToLine className="size-3.5" /> Download artifact</button>)}</div>}
                <div className="mt-4 flex gap-2">
                  {!terminalJob(job.state) && <button onClick={() => void handleJobAction(job, 'cancel')} disabled={job.version === undefined} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">Cancel job</button>}
                  {job.retryable && <button onClick={() => void handleJobAction(job, 'retry')} disabled={job.version === undefined} className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40">Retry job</button>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    )
  }

  async function runMatlab(path: '/v1/matlab/analyze' | '/v1/matlab/live', imageBase64: string) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64, session_id: matlabSessionRef.current }),
    })
    const payload = await response.json() as MatlabResult & { error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || 'MATLAB did not return a measurement.')
    setMatlabResult(payload)
    setMatlabConnected(true)
  }

  async function analyzeMatlabPicture(file: File) {
    setMatlabBusy(true)
    setError('')
    try {
      const dataUrl = await fileToDataUrl(file)
      await runMatlab('/v1/matlab/analyze', dataUrl.split(',')[1] || '')
    } catch (problem) {
      setMatlabConnected(false)
      setError(problem instanceof Error ? problem.message : 'MATLAB could not analyze the picture.')
    } finally {
      setMatlabBusy(false)
    }
  }

  async function sendLiveFrame() {
    const video = matlabVideoRef.current
    if (!video || video.videoWidth === 0 || !matlabLiveRef.current) return
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = Math.max(1, Math.round(video.videoHeight * (320 / video.videoWidth)))
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
    try {
      await runMatlab('/v1/matlab/live', dataUrl.split(',')[1] || '')
    } catch (problem) {
      matlabLiveRef.current = false
      setMatlabLive(false)
      setMatlabConnected(false)
      setError(problem instanceof Error ? problem.message : 'MATLAB could not track the live frame.')
    }
  }

  async function startMatlabLive() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    if (matlabVideoRef.current) {
      matlabVideoRef.current.srcObject = stream
      await matlabVideoRef.current.play()
    }
    matlabLiveRef.current = true
    setMatlabLive(true)
    setError('')
    const tick = async () => {
      if (!matlabLiveRef.current) return
      await sendLiveFrame()
      if (matlabLiveRef.current) window.setTimeout(() => void tick(), 700)
    }
    void tick()
  }

  function stopMatlabLive() {
    matlabLiveRef.current = false
    setMatlabLive(false)
    const stream = matlabVideoRef.current?.srcObject
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop())
  }

  async function uploadBlenderPackage(file: File) {
    setBlenderBusy(true)
    setBlenderBuild('')
    try {
      const body = JSON.parse(await file.text()) as unknown
      const response = await fetch('/v1/blender/package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await response.json().catch(() => ({})) as BlenderPackageView & { error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message || 'The product record was not stored.')
      setBlenderPackage(payload)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The product record was not stored.')
    } finally {
      setBlenderBusy(false)
    }
  }

  async function buildBlenderTwin() {
    setBlenderBusy(true)
    setBlenderBuild('')
    try {
      const response = await fetch('/v1/blender/build', { method: 'POST' })
      const payload = await response.json().catch(() => ({})) as { glb?: string; usd?: string | null; usd_error?: string; objects?: string[]; error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message || 'Blender did not build the envelopes.')
      const files = [payload.glb, payload.usd].filter(Boolean).join(' and ')
      setBlenderBuild(`Built ${payload.objects?.length ?? 0} envelopes. Omniverse files: ${files}${payload.usd_error ? `. USD: ${payload.usd_error}` : ''}`)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Blender did not build the envelopes.')
    } finally {
      setBlenderBusy(false)
    }
  }

  function renderBlender() {
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Blender digital twin</h2>
          <p className="mt-1 text-sm text-muted-foreground">The product workspace collection record becomes envelope blocks in Blender, then a GLB and USD for the NVIDIA Omniverse scene. Sizes come only from the recorded length, width, and height.</p>
        </div>
        <div className={`mb-5 rounded-xl border p-4 text-xs leading-5 ${blenderConnected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>{blenderMessage}</div>
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold">Product workspace package</h3>
          <p className="mt-1 text-xs text-muted-foreground">Send the record from the product workspace, or upload FlexVision_Product_Project_Records.json. The admin digital twin workspace is not uploaded yet.</p>
          <input type="file" accept="application/json,.json" disabled={blenderBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void uploadBlenderPackage(file) }} className="mt-3 block w-full text-xs" />
          <button type="button" onClick={() => void buildBlenderTwin()} disabled={blenderBusy || !blenderPackage?.part_count} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">{blenderBusy ? 'Working' : 'Build envelopes in Blender'}</button>
          {blenderBuild ? <p className="mt-3 text-xs text-muted-foreground">{blenderBuild}</p> : null}
        </section>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {!blenderPackage ? <p className="p-4 text-xs text-muted-foreground">No product record stored yet.</p> : (
            <>
              <p className="border-b border-border/70 p-3 text-xs text-muted-foreground">{blenderPackage.part_count} sized parts · {blenderPackage.unresolved_count} unresolved. {blenderPackage.warning}</p>
              {blenderPackage.parts.map((part) => (
                <div key={part.name} className="grid grid-cols-2 gap-2 border-b border-border/70 p-3 text-xs last:border-b-0 sm:grid-cols-4">
                  <span className="font-medium">{part.name}</span>
                  <span>{part.size} {part.units}</span>
                  <span>{part.status}</span>
                  <span>Envelope</span>
                </div>
              ))}
              {blenderPackage.unresolved.map((item) => (
                <div key={item.name} className="grid grid-cols-2 gap-2 border-b border-border/70 p-3 text-xs last:border-b-0">
                  <span className="font-medium">{item.name}</span>
                  <span>{item.reason}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  function renderMatlab() {
    const rows = matlabResult?.tracks?.length ? matlabResult.tracks.map((track) => ({ key: track.track_id, label: track.track_id, ...track })) : (matlabResult?.regions ?? []).map((region) => ({ key: region.id, label: region.id, ...region, missed: 0 }))
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">MATLAB vision</h2>
          <p className="mt-1 text-sm text-muted-foreground">Picture area analysis and live object tracking. Measurements come from the MATLAB service, using the luminance threshold from the camera pipeline.</p>
        </div>
        <div className={`mb-5 rounded-xl border p-4 text-xs leading-5 ${matlabConnected ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>{matlabMessage}</div>        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Picture</h3>
            <p className="mt-1 text-xs text-muted-foreground">Send one image. MATLAB returns each bright region area, centroid, and box.</p>
            <input type="file" accept="image/*" disabled={matlabBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeMatlabPicture(file) }} className="mt-3 block w-full text-xs" />
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h3 className="text-sm font-semibold">Live</h3>
            <p className="mt-1 text-xs text-muted-foreground">Send camera frames to the same MATLAB session. A track id stays with a region while its centroid remains nearby.</p>
            <video ref={matlabVideoRef} muted playsInline className="mt-3 aspect-video w-full rounded-lg bg-muted object-cover" />
            <div className="mt-3 flex gap-2">
              {!matlabLive ? <button onClick={() => void startMatlabLive().catch((problem: unknown) => setError(problem instanceof Error ? problem.message : 'The camera could not start.'))} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Start live tracking</button> : <button onClick={stopMatlabLive} className="rounded-lg border border-border px-3 py-2 text-xs">Stop live tracking</button>}
            </div>
          </section>
        </div>
        <div className="mt-4 overflow-hidden rounded-xl border border-border">
          {rows.length === 0 ? <p className="p-4 text-xs text-muted-foreground">{matlabBusy ? 'Waiting for MATLAB.' : 'No MATLAB regions yet.'}</p> : rows.map((row) => (
            <div key={row.key} className="grid grid-cols-2 gap-2 border-b border-border/70 p-3 text-xs last:border-b-0 sm:grid-cols-4">
              <span className="font-medium">{row.label}</span>
              <span>{row.area_px} px</span>
              <span>center {row.centroid_xy.map((value) => value.toFixed(1)).join(', ')}</span>
              <span>box {row.bbox_xywh.map((value) => Math.round(value)).join(', ')}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  async function generateCredential() {
    setCredentialBusy(true)
    setCredentialCopied(false)
    setError('')
    try {
      const response = await fetch('/v1/credentials/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: credentialInput }),
      })
      const payload = await response.json() as { key?: string; base_id?: string; error?: { message?: string } }
      if (!response.ok || !payload.key || !payload.base_id) throw new Error(payload.error?.message || 'A credential key was not created.')
      setCredentialKey(payload.key)
      setCredentialBaseId(payload.base_id)
      setCredentialFiles([])
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'A credential key was not created.')
    } finally {
      setCredentialBusy(false)
    }
  }

  async function copyCredential() {
    if (!credentialKey) return
    const field = credentialFieldRef.current
    field?.focus()
    field?.select()
    try {
      await navigator.clipboard.writeText(credentialKey)
      setCredentialCopied(true)
      setError('')
      return
    } catch {
      const copied = document.execCommand('copy')
      if (!copied) {
        setError('The key is selected. Press Ctrl+C to copy it.')
        return
      }
      setCredentialCopied(true)
      setError('')
    }
  }

  async function refreshCredentialFiles(baseId = credentialBaseId) {
    if (!baseId) return
    const response = await fetch(`/v1/credentials/bases/${baseId}`)
    const payload = await response.json() as { files?: CredentialAttachment[]; error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || 'The library base could not be read.')
    setCredentialFiles(payload.files ?? [])
  }

  async function attachCredentialFile(file: File) {
    if (!credentialBaseId) return
    setCredentialBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const response = await fetch(`/v1/credentials/bases/${credentialBaseId}/files`, { method: 'POST', body: form })
      const payload = await response.json() as { error?: { message?: string } }
      if (!response.ok) throw new Error(payload.error?.message || 'The file could not be attached.')
      await refreshCredentialFiles()
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The file could not be attached.')
    } finally {
      setCredentialBusy(false)
    }
  }

  async function moveCredentialAttachment(fileId: string, direction: 'earlier' | 'later') {
    const response = await fetch(`/v1/credentials/bases/${credentialBaseId}/files/${fileId}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
    })
    const payload = await response.json() as { files?: CredentialAttachment[]; error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || 'The file could not be moved.')
    setCredentialFiles(payload.files ?? [])
  }

  async function workflowCredentialAttachment(fileId: string, page: WorkflowPage) {
    const response = await fetch(`/v1/credentials/bases/${credentialBaseId}/files/${fileId}/workflow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page }),
    })
    const payload = await response.json() as { error?: { message?: string } }
    if (!response.ok) throw new Error(payload.error?.message || 'The file could not be sent to that page.')
    await refreshCredentialFiles()
    setSection(page)
  }

  function renderWorkflowFiles() {
    if (section === 'Credential' || section === 'Library' || workflowFiles.length === 0) return null
    return (
      <div className="mx-auto w-full max-w-4xl px-5 pt-5 lg:px-10">
        <h2 className="text-sm font-semibold">Files workflowed to this page</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {workflowFiles.map((file) => (
            <div key={file.file_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 p-3 text-xs last:border-b-0">
              <span><span className="font-medium">{file.filename}</span><span className="mt-1 block font-mono text-[10px] text-muted-foreground">{file.file_id}</span></span>
              <a href={`/v1/credentials/bases/${file.base_id}/files/${file.file_id}`} className="rounded-lg border border-border px-3 py-2">Open file</a>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function renderCredential() {
    return (
      <div className="mx-auto w-full max-w-3xl p-5 lg:p-10">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">Credential key</h2>
          <p className="mt-1 text-sm text-muted-foreground">Type any random text. The key is 12 letters and numbers. Creating it also opens a library base with its own UUID for file attachments.</p>
        </div>
        <label className="block text-xs text-muted-foreground">Random input
          <textarea value={credentialInput} onChange={(event) => setCredentialInput(event.target.value)} maxLength={500} className="mt-2 min-h-24 w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none" placeholder="Type or paste random characters" />
        </label>
        <button type="button" onClick={() => void generateCredential()} disabled={credentialBusy} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">{credentialBusy ? 'Creating key' : 'Create key'}</button>
        {credentialKey && (
          <div className="mt-5 rounded-xl border border-border bg-card p-4">
            <input ref={credentialFieldRef} readOnly value={credentialKey} aria-label="Credential key" className="w-full bg-transparent font-mono text-lg tracking-[0.2em] outline-none" />
            <button type="button" onClick={() => void copyCredential().catch(() => setError('The key could not be copied. Select it and copy it manually.'))} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs">{credentialCopied ? 'Copied' : 'Copy key'}</button>
            <p className="mt-4 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Library base UUID</p>
            <input readOnly value={credentialBaseId} aria-label="Library base UUID" className="mt-1 w-full bg-transparent font-mono text-xs outline-none" />
          </div>
        )}
        {credentialBaseId && (
          <section className="mt-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Attachments in this base</h3>
              <button type="button" onClick={() => credentialFileRef.current?.click()} disabled={credentialBusy} className="rounded-lg border border-border px-3 py-2 text-xs disabled:opacity-50">Attach file</button>
              <input ref={credentialFileRef} type="file" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void attachCredentialFile(file); event.target.value = '' }} />
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              {credentialFiles.length === 0 ? <p className="p-4 text-xs text-muted-foreground">No files are attached to this UUID yet.</p> : credentialFiles.map((file, index) => (
                <div key={file.file_id} className="grid gap-3 border-b border-border/70 p-3 text-xs last:border-b-0 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div>
                    <p className="font-medium">{file.filename}</p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">{file.file_id}</p>
                    <p className="mt-1 text-muted-foreground">{file.page ? `Workflowed to ${file.page}` : 'Stays in this base'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" disabled={index === 0} onClick={() => void moveCredentialAttachment(file.file_id, 'earlier').catch((problem: unknown) => setError(problem instanceof Error ? problem.message : 'The file could not be moved.'))} className="rounded-lg border border-border px-2 py-2 disabled:opacity-40">Move up</button>
                    <button type="button" disabled={index === credentialFiles.length - 1} onClick={() => void moveCredentialAttachment(file.file_id, 'later').catch((problem: unknown) => setError(problem instanceof Error ? problem.message : 'The file could not be moved.'))} className="rounded-lg border border-border px-2 py-2 disabled:opacity-40">Move down</button>
                    <label className="flex items-center gap-2">Page
                      <select id={`workflow-${file.file_id}`} defaultValue="Library" className="rounded-lg border border-border bg-muted px-2 py-2" aria-label={`Workflow page for ${file.filename}`}>
                        {WORKFLOW_PAGES.map((page) => <option key={page}>{page}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={() => {
                      const select = document.getElementById(`workflow-${file.file_id}`)
                      const page = select instanceof HTMLSelectElement ? select.value : 'Library'
                      if (!WORKFLOW_PAGES.includes(page as WorkflowPage)) return
                      void workflowCredentialAttachment(file.file_id, page as WorkflowPage).catch((problem: unknown) => setError(problem instanceof Error ? problem.message : 'The file could not be sent to that page.'))
                    }} className="rounded-lg bg-primary px-3 py-2 font-medium text-primary-foreground">Workflow file</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  function pressKeypad(key: string) {
    setKeypadMessage('')
    if (key === 'C') {
      setKeypadDigits('')
      return
    }
    if (key === '⌫') {
      setKeypadDigits((current) => current.slice(0, -1))
      return
    }
    setKeypadDigits((current) => {
      const next = `${current}${key}`.replace(/^0+/, '')
      if (next.length > 6) return current
      const cents = Number(next || '0')
      if (!Number.isInteger(cents) || cents > PIGGY_MAX_CENTS) return current
      return next
    })
  }

  async function submitKeypad() {
    if (keypadLock.current) return
    const amountCents = Number(keypadDigits)
    if (!Number.isInteger(amountCents) || amountCents < 1 || amountCents > PIGGY_MAX_CENTS) return
    keypadLock.current = true
    setKeypadBusy(true)
    setError('')
    try {
      const response = await fetch('/v1/piggybank/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount_cents: amountCents, idempotency_key: createId() }),
      })
      const payload = await response.json() as { entries?: SavingsEntry[]; events?: WorkflowEvent[]; entry?: SavingsEntry; error?: { message?: string } }
      if (!response.ok || !payload.entry || !payload.entries || !payload.events) throw new Error(payload.error?.message || 'The keypad amount was not recorded.')
      setLedgerEntries(payload.entries)
      setLedgerEvents(payload.events)
      setKeypadDigits('')
      setKeypadMessage(`${formatCents(payload.entry.amount_cents)} was written as ${payload.entry.amount_cents} cents to the CSV and JSON ledger.`)
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'The keypad amount was not recorded.')
    } finally {
      keypadLock.current = false
      setKeypadBusy(false)
    }
  }

  function renderPiggybank() {
    const ledgerRows = ledgerEntries.length > 0 ? ledgerEntries : piggybankUpdate.ledger.map((entry) => ({
      entry_id: entry.entryId,
      goal_id: entry.goalId,
      amount_cents: entry.amountCents,
      currency: 'USD' as const,
      method: 'simulated_cash' as const,
      source: entry.source as SavingsEntry['source'],
      status: entry.status as SavingsEntry['status'],
      idempotency_key: '',
      created_at_utc: entry.createdAtUtc,
      note: '',
    }))
    const workflowRows = ledgerEvents.length > 0 ? ledgerEvents : piggybankUpdate.events.map((event) => ({
      event_id: event.eventId,
      event_type: event.eventType,
      source_record_id: event.sourceRecordId,
      run_id: '',
      status: event.status,
      created_at_utc: event.createdAtUtc,
      error_code: '',
    }))
    const recordedCents = ledgerRows.reduce((total, entry) => total + entry.amount_cents, 0)
    const keypadCents = Number(keypadDigits || '0')
    const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫']
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Latest PRD update</p>
          <h2 className="mt-1 text-xl font-semibold">{piggybankUpdate.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{piggybankUpdate.revision} · {piggybankUpdate.verification} · {piggybankUpdate.dotId}</p>
        </div>
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-5 text-amber-100">{piggybankUpdate.summary} Sample amounts are fictional. Keypad entries stay in the local ledger.</div>
        <section className="mt-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Digital keypad</h3>
              <p className="mt-1 text-xs text-muted-foreground">Digits fill cents from the right. Add dollars writes the amount into the savings CSV and JSON.</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-3xl">{formatCents(keypadCents)}</p>
              <p className="text-xs text-muted-foreground">{keypadCents} cents · simulated_cash · ui_keypad</p>
            </div>
          </div>
          <div className="mt-4 grid max-w-xs grid-cols-3 gap-2">
            {keypadKeys.map((key) => (
              <button key={key} type="button" onClick={() => pressKeypad(key)} aria-label={key === 'C' ? 'Clear amount' : key === '⌫' ? 'Delete last digit' : `Digit ${key}`} className="h-12 rounded-xl border border-border bg-background text-lg font-medium hover:bg-muted">{key}</button>
            ))}
          </div>
          <button type="button" onClick={() => void submitKeypad()} disabled={keypadBusy || keypadCents < 1} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50">{keypadBusy ? 'Writing ledger' : 'Add dollars'}</button>
          {keypadMessage && <p className="mt-3 text-xs text-emerald-300">{keypadMessage}</p>}
        </section>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Recorded ledger</p><p className="mt-2 text-lg font-semibold">{formatCents(recordedCents)}</p><p className="text-xs text-muted-foreground">{ledgerRows.length} ledger entries</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Scheduled pull</p><p className="mt-2 text-lg font-semibold">{piggybankUpdate.workflow.enabled ? 'Enabled' : 'Disabled'}</p><p className="text-xs text-muted-foreground">{piggybankUpdate.workflow.cadence} · {piggybankUpdate.workflow.localTime}</p></div>
          <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Run state</p><p className="mt-2 font-mono text-sm">{piggybankUpdate.workflow.statusWord}</p><p className="text-xs text-muted-foreground">{piggybankUpdate.workflow.activeFlag} · {piggybankUpdate.workflow.statusRevision}</p></div>
        </div>
        <section className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Savings ledger</h3>
            <div className="flex gap-2 text-xs">
              <a href="/v1/piggybank/ledger?format=csv" className="rounded-lg border border-border px-3 py-2">Download CSV</a>
              <a href="/v1/piggybank/ledger?format=json" className="rounded-lg border border-border px-3 py-2">Download JSON</a>
            </div>
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            {ledgerRows.map((entry) => (
              <div key={entry.entry_id} className="grid gap-1 border-b border-border/70 p-3 text-xs last:border-b-0 sm:grid-cols-4">
                <span className="font-medium">{formatCents(entry.amount_cents)}</span>
                <span>{entry.source}</span>
                <span>{entry.status}</span>
                <span className="text-muted-foreground">{entry.created_at_utc}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-6">
          <h3 className="text-sm font-semibold">{piggybankUpdate.workflow.name}</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">The next run is not set. Push and email are status preferences. Instruction text is not sent to a shell. The status word records state only.</p>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">{piggybankUpdate.workflow.dotId}</p>
        </section>
        <section className="mt-6">
          <h3 className="text-sm font-semibold">Workflow trace</h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            {workflowRows.map((event) => (
              <div key={event.event_id} className="grid gap-1 border-b border-border/70 p-3 text-xs last:border-b-0 sm:grid-cols-3">
                <span className="font-medium">{event.event_type}</span>
                <span>{event.status}</span>
                <span className="text-muted-foreground">{event.created_at_utc}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-6">
          <h3 className="text-sm font-semibold">Library identifiers</h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-border">
            {piggybankUpdate.records.map((record) => (
              <div key={record.dotId} className="border-b border-border/70 p-3 text-xs last:border-b-0">
                <p className="font-medium">{record.name}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{record.dotId}</p>
                <p className="mt-1 text-muted-foreground">{record.type} · {record.revision} · {record.status}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    )
  }

  function renderSection() {
    if (section === 'Engineering chat') return renderChat()
    if (section === 'Library') return renderLibrary()
    if (section === 'Parts & BOM') return renderJobs('bom')
    if (section === 'CAD queue') return renderJobs('cad')
    if (section === 'MATLAB') return renderMatlab()
    if (section === 'Blender') return renderBlender()
    if (section === 'Credential') return renderCredential()
    if (section === 'Piggybank') return renderPiggybank()
    return (
      <div className="mx-auto w-full max-w-4xl p-5 lg:p-10">
        <div className="mb-6"><h2 className="text-xl font-semibold">Analytics</h2><p className="mt-1 text-sm text-muted-foreground">Operational and business measures for this workspace.</p></div>
        <EmptyState title="Analytics API not defined" detail="The PRD proposes queue aging, citation quality, artifact failure rate, BOM completeness, sync latency, and cost metrics. No analytics endpoint is included in the current API contract." />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.docx,.csv,.xlsx,.txt,.md,.json" onChange={(event) => void handleUpload(event.target.files?.[0])} />
      <header className="hidden">
        <div className="flex min-w-0 items-center gap-3">
          <button onClick={() => setMobileNavOpen((open) => !open)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Toggle navigation"><Menu className="size-5" /></button>
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Sparkles className="size-4" /></div>
          <a href="/" className="min-w-0 no-underline" aria-label="Flex-Vision home"><p className="truncate text-sm font-semibold tracking-tight">TKOW Engineering AI</p><p className="truncate text-[11px] text-muted-foreground">AI chatbot section</p></a>
        </div>
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <a href="/v1/onshape/connect" className={`hidden h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs leading-none sm:inline-flex ${onshapeConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}><span className={`size-1.5 shrink-0 rounded-full ${onshapeConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />{onshapeConnected ? 'Onshape connected' : 'Connect Onshape'}</a>
          <button type="button" onClick={() => setSection('MATLAB')} className={`hidden h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs leading-none sm:inline-flex ${matlabConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}><span className={`size-1.5 shrink-0 rounded-full ${matlabConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />{matlabConnected ? 'MATLAB connected' : 'Connect MATLAB'}</button>
          <button type="button" onClick={() => setSection('Blender')} className={`hidden h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-xs leading-none sm:inline-flex ${blenderConnected ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}><span className={`size-1.5 shrink-0 rounded-full ${blenderConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />{blenderConnected ? 'Blender connected' : 'Connect Blender'}</button>
          <span className={`hidden h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 text-xs leading-none sm:inline-flex ${configured ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>{configured ? (configuration.localChat ? 'Local chat API' : 'External API') : 'Project ID required'}</span>
          <button onClick={() => setShowSettings((open) => !open)} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted" aria-label="Connection settings"><Settings2 className="size-4" /></button>
          <button onClick={() => setError('Help: configure the backend URL and project ID, then sign in through the API host before uploading or chatting.')} className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted sm:flex"><CircleHelp className="size-3.5" /> Help</button>
        </div>
        {showSettings && <div className="absolute right-4 top-14 z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl">
          <p className="text-sm font-semibold">Project connection</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{configuration.localChat ? 'Chat is sent to this app at /v1/chat. Set NEXT_PUBLIC_API_BASE_URL to use a different API host.' : 'Chat is sent to NEXT_PUBLIC_API_BASE_URL. Project membership still has to be verified by that host.'}</p>
          <label className="mt-4 block text-xs font-medium" htmlFor="project-id">Project ID</label>
          <input id="project-id" value={projectId} onChange={(event) => setProjectId(event.target.value)} placeholder="project-id" className="mt-1 w-full rounded-lg border border-border bg-muted px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/40" />
          <button onClick={() => setShowSettings(false)} className="mt-3 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Done</button>
        </div>}
      </header>

      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_288px]">
        <aside className={`${mobileNavOpen ? 'absolute inset-y-0 left-0 z-10 flex w-72 shadow-2xl' : 'hidden'} min-h-screen flex-col border-r border-border/70 bg-background p-4 lg:relative lg:flex lg:w-auto lg:shadow-none`}>
          <div className="mb-5 flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 text-left text-xs">
            <span className="flex min-w-0 items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${configured ? 'bg-emerald-400' : 'bg-amber-400'}`} /><span className="truncate">{projectId || 'Select a project ID'}</span></span><ChevronDown className="size-4 text-muted-foreground" />
          </div>
          <button onClick={beginNewConversation} className="mb-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"><Plus className="size-4" /> New conversation</button>
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
          <nav className="flex flex-col gap-1" aria-label="Workspace sections">{sections.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setSection(label); setMobileNavOpen(false) }} aria-current={section === label ? 'page' : undefined} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${section === label ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="size-4" /><span>{label}</span></button>)}</nav>
          <div className="my-6 border-t border-border/70" />
          <div className="flex items-center justify-between px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent activity</p><span className="text-[10px] text-muted-foreground">{activeJobs.length} active</span></div>
          {jobs.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No jobs this session</p> : <div className="mt-2 flex flex-col gap-1">{jobs.slice(0, 4).map((job) => <button key={`${job.job_id}-${job.createdAt}`} onClick={() => setSection(job.kind === 'cad' ? 'CAD queue' : job.kind === 'bom' ? 'Parts & BOM' : 'Engineering chat')} className="truncate rounded-lg px-2 py-2 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">{job.kind.toUpperCase()} · {job.state}</button>)}</div>}
        </aside>

        <section className="flex min-h-screen min-w-0 flex-col">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setMobileNavOpen((open) => !open)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Toggle navigation"><Menu className="size-5" /></button>
              <div><h1 className="text-sm font-semibold">{section}</h1><p className="mt-1 text-xs text-muted-foreground">{section === 'Engineering chat' ? 'Grounded answers from authorized project evidence' : `Project ${projectId || 'not selected'}`}</p></div>
            </div>
            {section === 'Engineering chat' && <button onClick={() => setShowSources((visible) => !visible)} className="hidden items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition hover:bg-muted md:flex xl:hidden"><PanelLeft className="size-3.5" /> {showSources ? 'Hide sources' : 'Show sources'}</button>}
          </div>
          {error && <div role="alert" className="mx-5 mt-4 flex items-start gap-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-xs leading-5 text-red-200 lg:mx-8"><span className="flex-1">{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X className="size-4" /></button></div>}
          {renderWorkflowFiles()}
          {renderSection()}
        </section>

        {section === 'Engineering chat' && showSources && <aside className="hidden border-l border-border/70 bg-card/35 p-5 xl:block">
          <div className="mb-5"><p className="text-sm font-semibold">Project context</p><p className="mt-1 truncate text-xs text-muted-foreground">{projectId || 'No project selected'}</p></div>
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium"><Zap className="size-3.5 text-primary" /> Evidence scope</div>
            <p className="text-[11px] leading-5 text-muted-foreground">{selectedSourceIds.length ? `${selectedSourceIds.length} revision${selectedSourceIds.length === 1 ? '' : 's'} selected from the library or this session.` : `Initial library has ${libraryDocuments.filter((document) => document.searchable).length} searchable engineering documents. Chat searches that library when none are selected.`}</p>
          </div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Cited in this conversation</p>
          {citedSources.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-xs leading-5 text-muted-foreground">Server-validated citations will appear here after an answer.</p> : <div className="flex flex-col gap-2">{citedSources.map((citation) => <div key={citation.revision_id} className="rounded-xl border border-border bg-card p-3"><p className="truncate text-xs font-medium">Revision {citation.revision_id}</p><p className="mt-1 text-[10px] text-muted-foreground">{citationLocator(citation)}</p></div>)}</div>}
          <div className="mt-8 rounded-xl border border-dashed border-border p-4 text-center">
            <Upload className="mx-auto mb-2 size-5 text-muted-foreground" /><p className="text-xs font-medium">Add engineering evidence</p><p className="mt-1 text-[10px] leading-4 text-muted-foreground">PDF, DOCX, CSV, XLSX, TXT, MD, JSON · up to 25 MiB</p>
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-3 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted disabled:opacity-50">Browse files</button>
            {uploading && <p className="mt-2 text-[10px] text-primary">Uploading and checking processing status…</p>}
          </div>
        </aside>}
      </div>
    </main>
  )
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('The picture could not be read.'))
    reader.readAsDataURL(file)
  })
}

function EvidenceList({ title, items }: { title: string; items: string[] }) {
  return <div className="mt-3 rounded-lg bg-muted/70 p-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p><ul className="list-inside list-disc text-xs leading-5">{items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div>
}

function EmptyState({ title, detail, actionLabel, onAction }: { title: string; detail: string; actionLabel?: string; onAction?: () => void }) {
  return <div className="rounded-xl border border-dashed border-border bg-card/40 p-8 text-center"><div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><BookOpen className="size-5" /></div><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-muted-foreground">{detail}</p>{actionLabel && onAction && <button onClick={onAction} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:bg-muted"><Plus className="size-3.5" />{actionLabel}</button>}</div>
}
