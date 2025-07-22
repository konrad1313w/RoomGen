import os
import sys
import glob
import json
import shutil
import threading
import multiprocessing

import numpy as np
import torch
import torch.nn.functional as F
import transformers
import openshape

# encoder load
pc_encoder = openshape.load_pc_encoder('openshape-pointbert-vitg14-rgb')

# CLIP text encoder
sys.clip_move_lock = threading.Lock()
clip_model = transformers.CLIPModel.from_pretrained(
    "laion/CLIP-ViT-bigG-14-laion2B-39B-b160k",
    low_cpu_mem_usage=True,
    torch_dtype=torch.float16
)
clip_prep = transformers.CLIPProcessor.from_pretrained(
    "laion/CLIP-ViT-bigG-14-laion2B-39B-b160k"
)
if torch.cuda.is_available():
    with sys.clip_move_lock:
        clip_model = clip_model.cuda()
device = clip_model.device
torch.set_grad_enabled(False)

def load_custom_shapes(folder_path):
    files = []
    for ext in ("*.glb", "*.obj"):
        files += glob.glob(os.path.join(folder_path, "**", ext), recursive=True)
    return files

def embed_mesh(path, num_samples=2048):
    """Sample a pointcloud from mesh and get its embedding."""
    pc = pc_encoder.load_pointcloud(path, num_samples=num_samples)  # (N,3)+(N,3colors)
    emb = pc_encoder.encode(pc.unsqueeze(0).to(pc_encoder.device))   # (1,C)
    return emb.squeeze().cpu().detach()

custom_folder = "./my_custom_shapes/"
os.makedirs(custom_folder, exist_ok=True)
file_paths = load_custom_shapes(custom_folder)

us_custom = []      # list of uids
feats_custom = []   # list of embeddings
meta_custom = {}    # metadata dict

for fp in file_paths:
    uid = os.path.basename(fp)
    emb = embed_mesh(fp)
    us_custom.append(uid)
    feats_custom.append(emb)
    meta_custom[uid] = {"path": fp}

feats_custom = torch.stack(feats_custom)  # (M, C)
print(f"Indexed {len(us_custom)} custom shapes.")

def retrieve_custom(query_emb, top_k=1, sim_threshold=0.0):
    """
    Cosine-sim search over your custom shapes.
    Returns list of dicts: {uid, sim, path}
    """
    q = F.normalize(query_emb.unsqueeze(0), dim=-1)      # (1, C)
    corpus = F.normalize(feats_custom, dim=-1)           # (M, C)
    sims = (q @ corpus.T).squeeze()                      # (M,)
    vals, idxs = torch.sort(sims, descending=True)
    results = []
    for sim, idx in zip(vals, idxs):
        if sim < sim_threshold:
            break
        uid = us_custom[idx]
        results.append({
            "uid": uid,
            "sim": float(sim),
            "path": meta_custom[uid]["path"]
        })
        if len(results) >= top_k:
            break
    return results

# process scene_graph.json exactly like original

def preprocess(text):
    import re
    t = re.sub(r'\d', '', text)
    return t.replace("_", " ")

# load scene description
with open("scene_graph.json", "r") as f:
    objects_in_room = json.load(f)

# Prepare output folder
destination_folder = os.path.join(os.getcwd(), "Assets")
os.makedirs(destination_folder, exist_ok=True)

for obj in objects_in_room:
    if not ("style" in obj and "material" in obj):
        continue

    style = obj["style"]
    material = obj["material"]
    obj_id = obj["new_object_id"]

    txt = preprocess(f"A high-poly {obj_id}") + f" with {material} material and in {style} style, high quality"

    # encode text
    inputs = clip_prep(text=[txt], return_tensors="pt", truncation=True, max_length=76).to(device)
    with torch.no_grad():
        text_emb = clip_model.get_text_features(**inputs).float().cpu()

    # retrieve from your custom shapes
    retrieved = retrieve_custom(text_emb, top_k=1, sim_threshold=0.1)
    if not retrieved:
        print(f"No match above threshold for {obj_id}")
        continue

    best = retrieved[0]
    print(f"{obj_id}  →  {best['uid']} (sim={best['sim']:.3f})")

    # copy the file into Assets/
    src_path = best["path"]
    dst_path = os.path.join(destination_folder, f"{obj_id}.glb")
    shutil.copy(src_path, dst_path)
    print(f"Copied {src_path} → {dst_path}")
