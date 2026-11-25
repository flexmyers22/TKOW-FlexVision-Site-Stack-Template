function result = tkowTrackFrame(imagePath, sessionId)
% Associate bright regions across live frames for one session.
% Nearest centroid within 40 pixels keeps the same track id.
arguments
    imagePath (1,1) string
    sessionId (1,1) string
end
persistent sessions
if isempty(sessions)
    sessions = containers.Map("KeyType", "char", "ValueType", "any");
end
analysis = tkowAnalyzeFrame(imagePath);
key = char(sessionId);
if isKey(sessions, key)
    previous = sessions(key);
else
    previous = struct("id", {}, "centroid_xy", {}, "missed", {});
end
nextId = 0;
if ~isempty(previous)
    numbers = arrayfun(@(track) str2double(extractAfter(track.id, 1)), previous);
    nextId = max(numbers);
end
used = false(1, numel(previous));
tracks = struct("track_id", {}, "area_px", {}, "centroid_xy", {}, "bbox_xywh", {}, "missed", {});
for index = 1:numel(analysis.regions)
    region = analysis.regions(index);
    best = 0;
    bestDistance = 40;
    for prior = 1:numel(previous)
        if used(prior)
            continue
        end
        delta = region.centroid_xy - previous(prior).centroid_xy;
        distance = hypot(delta(1), delta(2));
        if distance < bestDistance
            best = prior;
            bestDistance = distance;
        end
    end
    if best == 0
        nextId = nextId + 1;
        trackId = "t" + string(nextId);
        missed = 0;
    else
        used(best) = true;
        trackId = string(previous(best).id);
        missed = 0;
    end
    tracks(end + 1) = struct( ...
        "track_id", trackId, ...
        "area_px", region.area_px, ...
        "centroid_xy", region.centroid_xy, ...
        "bbox_xywh", region.bbox_xywh, ...
        "missed", missed); %#ok<AGROW>
end
stored = struct("id", {}, "centroid_xy", {}, "missed", {});
for index = 1:numel(tracks)
    stored(index) = struct("id", char(tracks(index).track_id), "centroid_xy", tracks(index).centroid_xy, "missed", 0);
end
for prior = 1:numel(previous)
    if used(prior) || previous(prior).missed >= 5
        continue
    end
    stored(end + 1) = struct("id", previous(prior).id, "centroid_xy", previous(prior).centroid_xy, "missed", previous(prior).missed + 1); %#ok<AGROW>
end
sessions(key) = stored;
result = analysis;
result.mode = "live";
result.session_id = sessionId;
result.tracks = tracks;
end
