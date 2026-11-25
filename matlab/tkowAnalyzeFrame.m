function result = tkowAnalyzeFrame(imagePath)
% Area analysis for one RGB picture. Uses the same integer luminance
% threshold as processCameraFolder (gray >= 180). Base MATLAB only.
arguments
    imagePath (1,1) string
end
rgb = imread(imagePath);
maxWidth = 640;
if size(rgb, 2) > maxWidth
    step = ceil(size(rgb, 2) / maxWidth);
    rgb = rgb(1:step:end, 1:step:end, :);
end
if ndims(rgb) == 2
    rgb = repmat(rgb, 1, 1, 3);
end
if size(rgb, 3) > 3
    rgb = rgb(:, :, 1:3);
end
if ~isa(rgb, "uint8")
    rgb = im2uint8(rgb);
end
r = uint16(rgb(:, :, 1));
g = uint16(rgb(:, :, 2));
b = uint16(rgb(:, :, 3));
gray = bitshift(77 * r + 150 * g + 29 * b, -8);
mask = gray >= 180;
labels = labelComponents(mask);
regions = struct("id", {}, "area_px", {}, "centroid_xy", {}, "bbox_xywh", {});
ids = unique(labels(labels > 0));
kept = 0;
for index = 1:numel(ids)
    [rows, cols] = find(labels == ids(index));
    area = numel(rows);
    if area < 25
        continue
    end
    kept = kept + 1;
    x = min(cols);
    y = min(rows);
    regions(kept) = struct( ...
        "id", string(kept), ...
        "area_px", area, ...
        "centroid_xy", [mean(cols), mean(rows)], ...
        "bbox_xywh", [x, y, max(cols) - x + 1, max(rows) - y + 1]); %#ok<AGROW>
end
result = struct( ...
    "source", "matlab", ...
    "width", size(rgb, 2), ...
    "height", size(rgb, 1), ...
    "threshold", 180, ...
    "regions", regions);
end

function labels = labelComponents(mask)
labels = zeros(size(mask));
[height, width] = size(mask);
nextId = 0;
for row = 1:height
    for col = 1:width
        if ~mask(row, col) || labels(row, col) ~= 0
            continue
        end
        nextId = nextId + 1;
        queue = [row, col];
        labels(row, col) = nextId;
        head = 1;
        while head <= size(queue, 1)
            r = queue(head, 1);
            c = queue(head, 2);
            head = head + 1;
            neighbors = [r - 1, c; r + 1, c; r, c - 1; r, c + 1];
            for n = 1:4
                rr = neighbors(n, 1);
                cc = neighbors(n, 2);
                if rr < 1 || cc < 1 || rr > height || cc > width
                    continue
                end
                if mask(rr, cc) && labels(rr, cc) == 0
                    labels(rr, cc) = nextId;
                    queue(end + 1, :) = [rr, cc]; %#ok<AGROW>
                end
            end
        end
    end
end
end
