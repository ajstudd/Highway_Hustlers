"""Offline, non-generative matting for the approved Lava Red Speed 400 photos.

Called by prepare-speed-lava.mjs. Dependencies belong in an isolated temporary
directory, not the website: opencv-python-headless and pymatting. No model weights,
image synthesis, old paint transfer, per-frame output fitting or network access.
"""
import sys
from pathlib import Path

cache, templates = map(Path, sys.argv[1:3])
for package_dir in sys.argv[3:]:
    sys.path.insert(0, package_dir)

import hashlib
import json
import cv2
import numpy as np
from pymatting import estimate_alpha_cf


def matte(photo, old):
    # The old genuine turntable has different paint and slightly different camera
    # geometry. Register it only to locate trimap seeds, NEVER copy its RGB/alpha
    # directly onto the output. Closed-form matting follows the new photo's edges.
    cv2.setRNGSeed(0)
    cv2.setNumThreads(1)
    h, w = photo.shape[:2]
    old_alpha = old[:, :, 3] / 255.0
    old_white = np.uint8(old[:, :, :3] * old_alpha[:, :, None]
                         + 255 * (1 - old_alpha[:, :, None]))
    sift = cv2.SIFT_create()
    k1, d1 = sift.detectAndCompute(cv2.cvtColor(old_white, cv2.COLOR_BGR2GRAY), None)
    k2, d2 = sift.detectAndCompute(cv2.cvtColor(photo, cv2.COLOR_BGR2GRAY), None)
    matches = cv2.BFMatcher().knnMatch(d1, d2, k=2)
    good = [a for a, b in matches if a.distance < .7 * b.distance]
    if len(good) < 20:
        raise ValueError('Too few matching geometry features; inspect this source')
    p1 = np.float32([k1[m.queryIdx].pt for m in good])
    p2 = np.float32([k2[m.trainIdx].pt for m in good])
    transform, inliers = cv2.estimateAffinePartial2D(
        p1, p2, method=cv2.RANSAC, ransacReprojThreshold=1)
    if transform is None or inliers.sum() < 20:
        raise ValueError('Geometry registration failed; do not substitute old paint')
    template = cv2.warpAffine(old_white, transform, (w, h), borderValue=(255, 255, 255))
    mask = cv2.warpAffine(old[:, :, 3], transform, (w, h))
    flow = cv2.DISOpticalFlow_create(cv2.DISOPTICAL_FLOW_PRESET_MEDIUM).calc(
        cv2.cvtColor(photo, cv2.COLOR_BGR2GRAY),
        cv2.cvtColor(template, cv2.COLOR_BGR2GRAY), None)
    xx, yy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
    guide = cv2.remap(mask, xx + flow[:, :, 0], yy + flow[:, :, 1], cv2.INTER_LINEAR)

    minimum = photo.min(axis=2)
    near = cv2.dilate(guide, np.ones((13, 13), np.uint8)) > 20
    inside = cv2.erode(guide, np.ones((5, 5), np.uint8)) > 250
    trimap = np.full((h, w), .5)
    trimap[(~near) | ((minimum > 248) & (guide < 120))] = 0
    # Dark narrow cables/spokes need foreground seeds even when erosion would
    # erase them. Mid-grey antialias pixels remain unknown, not opaque halos.
    trimap[inside | ((minimum < 90) & near)] = 1
    rgb = photo[:, :, ::-1].astype(float) / 255
    alpha = estimate_alpha_cf(rgb, trimap,
                              laplacian_kwargs={'epsilon': 1e-7},
                              cg_kwargs={'maxiter': 2000})
    alpha[alpha < .005] = 0
    alpha[alpha > .995] = 1
    # Remove the known white background's contribution from partial edge pixels.
    # Opaque factory RGB is bit-exact; only antialias RGB is decontaminated.
    foreground = np.clip((rgb - (1 - alpha[:, :, None]))
                         / np.maximum(alpha[:, :, None], .001), 0, 1)
    rgba = np.dstack([np.uint8(np.round(foreground[:, :, ::-1] * 255)),
                      np.uint8(np.round(alpha * 255))])
    rgba[rgba[:, :, 3] == 255, :3] = photo[rgba[:, :, 3] == 255]
    return rgba, {'matches': len(good), 'inliers': int(inliers.sum()),
                  'transform': transform.tolist()}


if __name__ == '__main__':
    report = []
    for i in range(36):
        source = cache / f'{i:02}-srgb.png'
        reference = templates / f'{i:02}.webp'
        photo = cv2.imread(str(source))
        old = cv2.imread(str(reference), cv2.IMREAD_UNCHANGED)
        if photo is None or old is None or old.shape[2] != 4:
            raise ValueError(f'Missing source or alpha guide: frame {i}')
        rgba, registration = matte(photo, old)
        output = cache / f'{i:02}-cutout-v2.png'
        if not cv2.imwrite(str(output), rgba):
            raise IOError(f'Could not write {output}')
        report.append({'frame': i, **registration,
                       'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                       'guideSha256': hashlib.sha256(reference.read_bytes()).hexdigest()})
        print(f'Matted frame {i + 1}/36', flush=True)
    (cache / 'matting-report-v2.json').write_text(json.dumps(report, indent=2) + '\n')
