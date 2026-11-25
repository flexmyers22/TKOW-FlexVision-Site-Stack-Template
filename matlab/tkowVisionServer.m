function tkowVisionServer(port)
% Local MATLAB connection for picture area analysis and live tracking.
% Uses the MATLAB Java runtime, so the Instrument Control Toolbox is not required.
% Start from this folder: tkowVisionServer
arguments
    port (1,1) double = 8788
end
thisDir = fileparts(mfilename("fullpath"));
addpath(thisDir);
server = java.net.ServerSocket(port, 16, java.net.InetAddress.getByName("127.0.0.1"));
server.setReuseAddress(true);
fprintf("TKOW MATLAB vision listening at http://127.0.0.1:%d\n", port);
cleanup = onCleanup(@() server.close()); %#ok<NASGU>
while true
    client = server.accept();
    try
        serveJavaClient(client);
    catch problem
        try
            writeJava(client, 500, struct("ok", false, "error", problem.message));
        catch
        end
    end
    try
        client.close();
    catch
    end
end
end

function serveJavaClient(client)
request = readJavaRequest(client);
if request.method == "GET" && request.path == "/health"
    writeJava(client, 200, struct("ok", true, "service", "tkow-matlab-vision"));
    return
end
if request.method ~= "POST" || (request.path ~= "/analyze" && request.path ~= "/live")
    writeJava(client, 404, struct("ok", false, "error", "Use POST /analyze or POST /live."));
    return
end
body = jsondecode(request.body);
if ~isfield(body, "image_base64")
    writeJava(client, 400, struct("ok", false, "error", "image_base64 is required."));
    return
end
bytes = matlab.net.base64decode(body.image_base64);
imagePath = fullfile(tempdir, "tkow-matlab-" + string(java.util.UUID.randomUUID()) + imageExtension(bytes));
fid = fopen(imagePath, "wb");
fwrite(fid, bytes, "uint8");
fclose(fid);
cleaner = onCleanup(@() deleteIfExists(imagePath)); %#ok<NASGU>
if request.path == "/live"
    sessionId = "live";
    if isfield(body, "session_id") && strlength(string(body.session_id)) > 0
        sessionId = string(body.session_id);
    end
    result = tkowTrackFrame(imagePath, sessionId);
else
    result = tkowAnalyzeFrame(imagePath);
    result.mode = "picture";
    result.tracks = struct("track_id", {}, "area_px", {}, "centroid_xy", {}, "bbox_xywh", {}, "missed", {});
end
writeJava(client, 200, result);
end

function extension = imageExtension(bytes)
bytes = uint8(bytes(:));
if numel(bytes) >= 2 && bytes(1) == 255 && bytes(2) == 216
    extension = ".jpg";
elseif numel(bytes) >= 8 && all(bytes(1:4).' == uint8([137 80 78 71]))
    extension = ".png";
else
    extension = ".ppm";
end
end

function request = readJavaRequest(client)
client.setSoTimeout(20000);
stream = client.getInputStream();
raw = uint8([]);
while true
    raw = [raw, readSocketBytes(stream)]; %#ok<AGROW>
    text = char(raw);
    splitAt = strfind(text, sprintf("\r\n\r\n"));
    if isempty(splitAt)
        continue
    end
    header = text(1:splitAt(1) - 1);
    tokens = regexp(header, "Content-Length:\s*(\d+)", "tokens", "ignorecase");
    needed = 0;
    if ~isempty(tokens)
        needed = str2double(tokens{1}{1});
    end
    bodyStart = splitAt(1) + 4;
    while numel(text) < bodyStart + needed - 1
        raw = [raw, readSocketBytes(stream)]; %#ok<AGROW>
        text = char(raw);
    end
    line = regexp(header, "^(\w+)\s+(\S+)", "tokens", "once");
    bodyEnd = min(numel(text), bodyStart + needed - 1);
    body = "";
    if needed > 0
        body = text(bodyStart:bodyEnd);
    end
    request = struct("method", string(line{1}), "path", string(line{2}), "body", body);
    return
end
end

function piece = readSocketBytes(stream)
value = stream.read();
if value < 0
    error("MATLAB connection closed before the request finished.");
end
piece = uint8(value);
extra = double(stream.available());
for index = 1:extra
    nextByte = stream.read();
    if nextByte < 0
        return
    end
    piece(end + 1) = uint8(nextByte); %#ok<AGROW>
end
end

function writeJava(client, status, payload)
reasons = containers.Map({200, 400, 404, 500}, {"OK", "Bad Request", "Not Found", "Error"});
body = jsonencode(payload);
reason = "Error";
if isKey(reasons, status)
    reason = reasons(status);
end
head = "HTTP/1.1 " + status + " " + reason + sprintf("\r\n") + ...
    "Content-Type: application/json" + sprintf("\r\n") + ...
    "Content-Length: " + strlength(body) + sprintf("\r\nConnection: close\r\n\r\n");
data = uint8(char(head + body));
signed = typecast(data, "int8");
out = client.getOutputStream();
out.write(signed);
out.flush();
end

function deleteIfExists(imagePath)
if isfile(imagePath)
    delete(imagePath);
end
end
