"""Prepare the licensed multipart Hunter for the Sunday game (not hero photos).

Run with Blender, which supplies bpy:
  blender -b --python scripts/prepare-ride-hunter.py -- SOURCE.glb OUTPUT.glb

Source-specific part IDs below were inspected against the actual downloaded mesh.
Do not reuse these IDs or infer wheel parts by material on a different model.
"""
import argparse
import json
import math
import os
import re
import sys

import bpy
from mathutils import Matrix, Vector


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source')
    parser.add_argument('output')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.source))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.context.view_layer.update()
    points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
    low = Vector([min(p[i] for p in points) for i in range(3)])
    high = Vector([max(p[i] for p in points) for i in range(3)])
    # First inspect in a stable 2.1 m frame, then calibrate the actual axle spacing.
    preliminary_scale = 2.1 / max(high - low)
    offset = Vector(((low.x + high.x) / 2, (low.y + high.y) / 2, low.z))
    preliminary = Matrix.Diagonal((preliminary_scale,) * 3 + (1,)) @ Matrix.Translation(-offset)
    wheelbase_scale = 1.37 / (0.64535 + 0.74525)
    transform = Matrix.Diagonal((wheelbase_scale,) * 3 + (1,)) @ preliminary
    # Detach before baking so parent scale/FBX axes never leak into the rig.
    for obj in meshes:
        baked = transform @ obj.matrix_world
        obj.parent = None
        obj.matrix_world = Matrix.Identity(4)
        obj.data.transform(baked)
    for obj in list(bpy.context.scene.objects):
        if obj.type != 'MESH':
            bpy.data.objects.remove(obj, do_unlink=True)

    def empty(name, location=(0, 0, 0), parent=None):
        obj = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(obj)
        obj.parent = parent
        obj.location = location
        return obj

    root = empty('Hunter350')
    root['source'] = 'https://sketchfab.com/3d-models/royal-enfield-hunter-350-181adce5a476412e8bcc272883225397'
    root['author'] = 'keshavckm1'
    root['license'] = 'CC-BY-4.0'
    root['changes'] = 'Metre calibration, geometry reduction, part batching, wheel and steering pivots. Original source colours retained.'
    chassis = empty('Chassis', parent=root)
    # Blender Z-up -> glTF Y-up. -Y forward here exports as +Z forward.
    steering = empty('Steering', Vector((0, -.412, .986)) * wheelbase_scale, root)
    front = empty('WheelFront', Vector((.00445, -.74525, .30475)) * wheelbase_scale, steering)
    front.location -= steering.location
    rear = empty('WheelRear', Vector((.00465, .64535, .3264)) * wheelbase_scale, root)
    front['radius'] = .30475 * wheelbase_scale
    rear['radius'] = .3155 * wheelbase_scale
    steering['axis'] = [0, math.cos(math.radians(26.5)), -math.sin(math.radians(26.5))]
    bpy.context.view_layer.update()
    front_ids = {11, 37, 91, 102, 149, 150, 163, 165, 211, 229, 239, 246,
                 266, 294, 327, 340, 344, 627, 662, 678, 685, 699, 725}
    rear_ids = {8, 9, 35, 69, 85, 87, 88, 138, 152, 185, 215, 242, 256,
                263, 271, 284, 287, 306, 313, 332, 638, 640, 671}
    # The two source meshes contain tens of thousands of triangles in tiny footpeg
    # springs. Treat detail by world-space size, preserving tyre/paint silhouettes.
    batches = {}
    before = sum(len(obj.data.polygons) for obj in meshes)
    for obj in meshes:
        match = re.match(r'polySurface(\d+)_', obj.name)
        if not match:
            raise ValueError('Unexpected source mesh: ' + obj.name)
        part = int(match.group(1))
        verts = [v.co for v in obj.data.vertices]
        lo = Vector([min(v[i] for v in verts) for i in range(3)])
        hi = Vector([max(v[i] for v in verts) for i in range(3)])
        size = max(hi - lo)
        if part in front_ids:
            parent = front
        elif part in rear_ids:
            parent = rear
        elif hi.y < -.27 * wheelbase_scale or part == 666:
            parent = steering
        else:
            parent = chassis
        # Keep the whole source palette for auditability. A Tokyo Black repaint
        # requires a separate livery pass, not a claim that this is factory colour.
        target = 80 if size < .04 else 180 if size < .12 else 650 if size < .35 else 2000
        if part in {239, 284, 246, 185}:
            target = 2400
        count = len(obj.data.polygons)
        if count > target:
            bpy.context.view_layer.objects.active = obj
            modifier = obj.modifiers.new('Browser geometry budget', 'DECIMATE')
            modifier.ratio = target / count
            modifier.use_collapse_triangulate = True
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        # Avoid hundreds of draw calls for bolts and chain links: one mesh per
        # material per animated assembly, without merging across rig boundaries.
        key = (parent.name, tuple(m.name for m in obj.data.materials if m))
        batches.setdefault(key, []).append(obj)

    assembled = []
    for (parent_name, materials), objects in batches.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        obj = bpy.context.view_layer.objects.active
        obj.name = parent_name + '_' + (materials[0] if materials else 'material')
        parent = bpy.data.objects[parent_name]
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()
        assembled.append(obj)

    # Contact markers are part of the exported hierarchy and follow steering.
    def marker(name, xyz, parent):
        world = Vector(xyz) * wheelbase_scale
        return empty(name, parent.matrix_world.inverted() @ world, parent)

    marker('GripLeft', (-.31, -.394, 1.025), steering)
    marker('GripRight', (.31, -.394, 1.025), steering)
    marker('SeatContact', (0, .215, .848), chassis)
    marker('FootLeft', (-.22, .076, .286), chassis)
    marker('FootRight', (.22, .076, .286), chassis)
    bpy.context.view_layer.update()
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.output), export_format='GLB',
                              export_extras=True, export_animations=False,
                              export_cameras=False, export_lights=False)
    print('PREPARED_HUNTER', json.dumps({
        'trianglesBefore': before,
        'trianglesAfter': sum(len(o.data.polygons) for o in assembled),
        'meshBatches': len(assembled),
        'bytes': os.path.getsize(args.output),
    }))


if __name__ == '__main__':
    main()
