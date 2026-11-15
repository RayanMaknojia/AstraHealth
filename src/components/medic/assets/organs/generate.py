# Original anatomical illustration meshes for Space Medic. CC0-1.0.
# Run: blender --background --python src/components/medic/assets/organs/generate.py
import bpy, math, random
from pathlib import Path
from mathutils import Vector
random.seed(42)
ROOT=Path(__file__).resolve().parent

def mat(name,c,rough=.42):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*c,1);bs.inputs['Roughness'].default_value=rough
 return m

def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def ell(name,loc,scale,material,rot=(0,0,0)):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=loc,rotation=rot)
 ob=bpy.context.object;ob.name=name;ob.scale=scale;ob.data.materials.append(material)
 for f in ob.data.polygons:f.use_smooth=True
 return ob

def tube(name,points,radius,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2;c.resolution_u=5
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for p,co in zip(s.bezier_points,points):p.co=co;p.handle_left_type='AUTO';p.handle_right_type='AUTO'
 ob=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(ob);ob.data.materials.append(material);return ob

def export(name):
 bpy.ops.object.select_all(action='SELECT')
 bpy.ops.object.convert(target='MESH')
 bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
 bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(ROOT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True)

pink=mat('Cortical tissue',(.63,.37,.36),.63);crease=mat('Sulcal tissue',(.44,.23,.24),.65)
red=mat('Myocardium',(.47,.07,.085),.38);artery=mat('Arterial tissue',(.64,.15,.15),.43);vein=mat('Venous tissue',(.18,.23,.36),.4)
liver=mat('Hepatic tissue',(.34,.075,.055),.4);bone=mat('Cortical bone',(.79,.70,.52),.62)
blue=mat('Phosphate A',(.16,.42,.64),.32);gold=mat('Phosphate B',(.65,.43,.24),.32);base=mat('Base pairs',(.63,.68,.73),.46)
reset()
# Paired cerebral hemispheres with explicit winding gyri and a central fissure.
for side in [-1,1]:
 ell('Cerebral hemisphere',(side*.46,0,.05),(.53,.66,.73),crease)
 for band in range(13):
  lat=-1.32+band*2.64/12;pts=[]
  for j in range(31):
   angle=2*math.pi*j/30;wiggle=.055*math.sin(angle*5+band*.9)
   x=side*(.46+.53*math.cos(lat)*math.cos(angle));y=.66*math.cos(lat)*math.sin(angle);z=.05+.73*math.sin(lat)+wiggle
   pts.append((x,y,z))
  tube('Cortical gyrus',pts,.052,pink)
ell('Cerebellum',(0,.25,-.65),(.48,.40,.23),pink)
tube('Brainstem',[(0,.13,-.65),(0,.12,-.95),(.02,.1,-1.13)],.12,pink)
export('brain')
reset()
# Asymmetric ventricles, atria, aorta, pulmonary trunk and coronary vessels.
ell('Left ventricle',(.15,0,-.05),(.48,.39,.73),red,(0,.25,0))
ell('Right ventricle',(-.30,-.09,.02),(.43,.35,.55),red,(0,-.3,0))
ell('Left atrium',(.30,.09,.52),(.31,.28,.25),red)
ell('Right atrium',(-.37,.02,.43),(.30,.30,.30),red)
tube('Aortic arch',[(.05,.1,.5),(.04,.12,1.0),(.27,.12,1.17),(.48,.17,.99),(.43,.22,.63)],.14,artery)
for x in [.12,.27,.41]:tube('Aortic branch',[(x,.12,1.10),(x-.04,.11,1.38)],.055,artery)
tube('Pulmonary artery',[(-.12,-.23,.35),(-.15,-.25,.8),(-.44,-.22,1.00),(-.7,-.15,.91)],.12,vein)
tube('Vena cava',[(-.47,.1,.40),(-.53,.10,.82),(-.52,.12,1.07)],.115,vein)
tube('Anterior descending artery',[(.02,-.39,.55),(-.03,-.42,.28),(.04,-.4,-.02),(.20,-.35,-.47)],.025,artery)
for i in range(4):
 z=.3-i*.17;tube('Coronary branch',[(.00,-.41,z),(.20,-.41,z-.04),(.40,-.31,z-.16)],.015,artery)
export('heart')
reset()
# Continuous asymmetric hepatic body, gently flattened underside and left lobe.
verts=[];faces=[];N=64;M=40
for j in range(M+1):
 t=math.pi*j/M
 for i in range(N):
  a=2*math.pi*i/N
  x=1.08*math.sin(t)*math.cos(a);y=.48*math.sin(t)*math.sin(a);z=.55*math.cos(t)
  z+=.15*x;z=max(z,-.32+.05*math.cos(a));y*=1-.22*(x+1)/2
  verts.append((x,y,z))
for j in range(M):
 for i in range(N):
  a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
mesh=bpy.data.meshes.new('Hepatic body');mesh.from_pydata(verts,[],faces);mesh.update();ob=bpy.data.objects.new('Liver',mesh);bpy.context.collection.objects.link(ob);ob.data.materials.append(liver)
for f in ob.data.polygons:f.use_smooth=True
ell('Gallbladder',(.12,-.30,-.30),(.13,.10,.27),mat('Gallbladder tissue',(.24,.3,.13),.48),(0,.3,0))
tube('Falciform ligament',[(.12,-.47,-.20),(.06,-.47,.12),(-.05,-.34,.45)],.018,mat('Ligament',(.61,.39,.31),.6))
export('liver')
reset()
# Double helical molecular illustration, with individual phosphate/base atoms.
for n in range(50):
 z=-1.3+n*2.6/49;a=n*.36
 for phase,material in [(0,blue),(math.pi,gold)]:
  ell('Phosphate',(.43*math.cos(a+phase),.43*math.sin(a+phase),z),(.085,.085,.085),material)
 if n%2==0:
  p=(.43*math.cos(a),.43*math.sin(a),z);q=(-p[0],-p[1],z)
  tube('Hydrogen bonded base pair',[p,(0,0,z),q],.028,base)
  for frac in [-.55,.55]:ell('Nucleobase',(p[0]*frac,p[1]*frac,z),(.062,.062,.062),base)
for phase,material in [(0,blue),(math.pi,gold)]:tube('Sugar phosphate backbone',[(.43*math.cos(n*.36+phase),.43*math.sin(n*.36+phase),-1.3+n*2.6/49) for n in range(50)],.04,material)
export('dna')
reset()
# Long femoral shaft with proximal neck, head, trochanter and distal condyles.
tube('Femoral shaft',[(.08,0,-.85),(.04,.03,-.35),(-.02,.04,.25),(-.1,0,.78)],.13,bone)
ell('Greater trochanter',(-.15,0,.83),(.23,.19,.28),bone)
tube('Femoral neck',[(-.05,0,.83),(.18,0,1.04),(.35,0,1.12)],.13,bone)
ell('Femoral head',(.38,0,1.15),(.24,.24,.24),bone)
ell('Medial condyle',(.22,0,-1.05),(.24,.25,.28),bone)
ell('Lateral condyle',(-.13,0,-1.05),(.23,.24,.27),bone)
export('bone')
