# Original, reference-guided anatomical illustrations. CC0-1.0.
# Single-view references guide appearance; unseen anatomy is an approximation.
# Run: blender --background --python src/components/medic/assets/organs/generate-reference-organs.py
import bpy, math, random
from pathlib import Path
from mathutils import Vector, noise
random.seed(47)
ROOT=Path(__file__).resolve().parent

def material(name,color,roughness=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=roughness
 return m

def reset():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def ell(name,loc,scale,mat,rotation=(0,0,0),detail=False):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=64 if detail else 20,ring_count=40 if detail else 12,location=loc,rotation=rotation)
 o=bpy.context.object;o.name=name;o.scale=scale;o.data.materials.append(mat)
 for face in o.data.polygons:face.use_smooth=True
 return o

def tube(name,points,radius,mat,wall=False):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=2;c.resolution_u=5;c.use_fill_caps=False
 s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
 for v,co in zip(s.bezier_points,points):v.co=co;v.handle_left_type='AUTO';v.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
 if wall:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
  mod=o.modifiers.new('Vessel wall','SOLIDIFY');mod.thickness=radius*.22;mod.offset=-1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def grain(o,amount=.006,frequency=22):
 for v in o.data.vertices:
  n=noise.noise(v.co*frequency)
  if v.co.length:v.co+=v.co.normalized()*amount*n
 o.data.update()

def export(name):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
 bpy.context.view_layer.objects.active=bpy.context.selected_objects[0];bpy.ops.object.join()
 bpy.ops.export_scene.gltf(filepath=str(ROOT/('reference-'+name+'.glb')),export_format='GLB',use_selection=True,export_yup=True)

cortex=material('Warm cortical tissue',(.50,.30,.31),.57)
cerebellar=material('Cerebellar tissue',(.42,.25,.26),.56)
myocardium=material('Cardiac muscle',(.42,.125,.13),.46)
vessel=material('Vessel tissue',(.52,.23,.24),.45)
coronary=material('Coronary vessels',(.60,.32,.32),.52)
hepatic=material('Liver capsule',(.30,.085,.075),.49)
ligament=material('Connective tissue',(.70,.55,.46),.6)
dna=material('Molecular illustration',(.52,.34,.35),.48)
bone=material('Ivory cortical bone',(.79,.72,.59),.59)
cartilage=material('Articular cartilage',(.60,.65,.67),.39)
muscle=material('Skeletal muscle',(.40,.09,.075),.53)
fiber=material('Muscle fibres',(.58,.22,.17),.56)
tendon=material('Fascia and tendon',(.75,.69,.59),.57)

reset()
# Hemispheres: sculpted cortical volume with warped, smoothly ridged sulcal boundaries.
for side in [-1,1]:
 bpy.ops.mesh.primitive_uv_sphere_add(segments=160,ring_count=100,location=(side*.34,0,.1))
 o=bpy.context.object;o.name='Cerebral hemisphere';o.data.materials.append(cortex)
 for v in o.data.vertices:
  u=v.co.copy();p=Vector((u.x*6.5,u.y*5.2,u.z*5.8));warp=noise.noise_vector(p*.48)*1.15
  ds=noise.voronoi(p+warp,distance_metric='DISTANCE')[0]
  edge=max(0,ds[1]-ds[0]);fold=.068*(1-math.exp(-edge*11))-.025
  x=u.x*(.49+fold);y=u.y*(.74+fold);z=u.z*(.64+fold)
  # Slightly flatten the medial surface, preserving a distinct longitudinal fissure.
  if side*x<-.31:x=-side*(.31+(.03*math.tanh((abs(x)-.31)*8)))
  v.co=(x,y,z)
 for f in o.data.polygons:f.use_smooth=True
for side in [-1,1]:
 o=ell('Cerebellar hemisphere',(side*.21,.35,-.52),(.28,.37,.25),cerebellar,detail=True)
 for v in o.data.vertices:
  u=v.co.copy();r=.025*math.cos(u.z*80+u.x*2);v.co.x*=1+r;v.co.y*=1+r
tube('Brainstem',[(0,.13,-.5),(0,.18,-.76),(0,.13,-.95)],.085,cortex)
export('brain')

reset()
# Asymmetric ventricles form a tapered apex and atrial shoulders.
o=ell('Ventricular myocardium',(.02,0,-.11),(.62,.39,.78),myocardium,detail=True)
for v in o.data.vertices:
 u=v.co.copy();t=(u.z+1)/2;v.co.x*=.57+.43*t;v.co.x+=.19*(1-t);v.co.y*=.90+.10*t
grain(o,.006,28)
ell('Right atrium',(-.43,.02,.43),(.27,.27,.30),myocardium,(0,-.18,0),True)
ell('Left atrium',(.36,.13,.45),(.25,.26,.25),myocardium,detail=True)
tube('Aortic arch',[(.03,.10,.48),(.02,.10,.98),(.18,.12,1.12),(.40,.12,1.09),(.48,.21,.73)],.135,vessel,True)
for x,z in [(.13,1.32),(.29,1.37),(.43,1.27)]:tube('Aortic arch branch',[(x,.12,1.05),(x-.025,.11,z)],.056,vessel,True)
tube('Pulmonary trunk',[(-.12,-.22,.39),(-.16,-.22,.78),(-.42,-.14,.91),(-.69,-.10,.88)],.115,vessel,True)
tube('Superior vena cava',[(-.43,.05,.45),(-.46,.06,.90),(-.48,.07,1.10)],.12,vessel,True)
tube('Inferior vena cava',[(-.45,.12,.30),(-.48,.15,-.05)],.09,vessel,True)
for side in [-1,1]:
 for z in [.40,.60]:tube('Pulmonary vein',[(side*.32,.18,z),(side*.65,.24,z+.03)],.067,vessel,True)
tube('Anterior interventricular artery',[(-.03,-.37,.50),(.01,-.40,.23),(.07,-.37,-.06),(.15,-.30,-.39),(.22,-.17,-.72)],.018,coronary)
for side in [-1,1]:
 for i in range(6):
  z=.4-i*.15;x=.02+i*.025
  tube('Coronary arterial branch',[(x,-.39,z),(x+side*.15,-.37,z-.04),(x+side*.29,-.27,z-.17)],.009,coronary)
  for j in range(2):
   tube('Fine coronary vessel',[(x+side*.12,-.375,z-.035),(x+side*(.17+j*.04),-.345,z+.025-j*.06),(x+side*(.23+j*.04),-.30,z+.04-j*.07)],.0045,coronary)
export('heart')

reset()
verts=[];faces=[];N=160;M=88
for j in range(M+1):
 t=math.pi*j/M
 for i in range(N):
  a=2*math.pi*i/N;ux=math.sin(t)*math.cos(a);uy=math.sin(t)*math.sin(a);uz=math.cos(t)
  x=ux*1.13;y=uy*.46*(1-.16*(ux+1));z=uz*.52*(1-.25*max(ux,0))+.12*ux
  z=max(z,-.30+.04*math.cos(a));groove=.025*math.exp(-((x-.19)/.035)**2)
  y+=groove if y<0 else -groove
  g=noise.noise(Vector((x,y,z))*60)*.0025;verts.append((x+g,y+g,z+g))
for j in range(M):
 for i in range(N):
  a=j*N+i;b=j*N+(i+1)%N;faces.append((a,b,b+N,a+N))
mesh=bpy.data.meshes.new('Liver surface');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('Liver capsule and lobes',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(hepatic)
for f in mesh.polygons:f.use_smooth=True
tube('Falciform ligament',[(.19,-.13,.48),(.19,-.33,.35),(.19,-.42,.05),(.20,-.32,-.24)],.009,ligament)
ell('Gallbladder',(.17,.18,-.30),(.095,.08,.20),material('Gallbladder',(.23,.28,.12),.52),(0,.3,0))
export('liver')

reset()
# Continuous helical strands with subtle repeating molecular lobes.
for phase in [0,math.pi]:
 N=240;S=16;vs=[];fs=[]
 for n in range(N+1):
  t=n/N;a=6*math.pi*t+phase;center=Vector((.36*math.cos(a),.36*math.sin(a),-1.3+2.6*t))
  tangent=Vector((-.36*6*math.pi*math.sin(a),.36*6*math.pi*math.cos(a),2.6)).normalized();radial=Vector((math.cos(a),math.sin(a),0));cross=tangent.cross(radial).normalized()
  radius=.078*(1+.10*math.cos(t*math.pi*80))
  for k in range(S):
   v=center+radius*(math.cos(k*2*math.pi/S)*radial+math.sin(k*2*math.pi/S)*cross);vs.append(v)
 for n in range(N):
  for k in range(S):p=n*S+k;q=n*S+(k+1)%S;fs.append((p,q,q+S,p+S))
 me=bpy.data.meshes.new('Helical strand');me.from_pydata(vs,[],fs);me.update();ob=bpy.data.objects.new('Double helix backbone',me);bpy.context.collection.objects.link(ob);ob.data.materials.append(dna)
 for f in me.polygons:f.use_smooth=True
for n in range(25):
 t=(n+.5)/25;a=6*math.pi*t;z=-1.3+2.6*t;p=Vector((.36*math.cos(a),.36*math.sin(a),z));q=Vector((-p.x,-p.y,z))
 tube('Paired nucleotide rung',[p,p*.5+Vector((0,0,z*.5)),Vector((0,0,z)),q*.5+Vector((0,0,z*.5)),q],.035,dna)
 for f in [-.65,-.25,.25,.65]:ell('Nucleotide structure',(p.x*f,p.y*f,z),(.045,.045,.043),dna)
export('dna')

reset()
# Knee-to-foot section: tibia/fibula, cartilage, calf muscles, Achilles and toe rays.
ell('Distal femur',(.03,.02,1.24),(.23,.18,.25),bone,detail=True)
for x in [-.12,.15]:ell('Femoral condyle',(x,-.035,1.08),(.14,.18,.14),bone,detail=True)
for x in [-.10,.14]:ell('Knee cartilage',(x,-.04,.94),(.14,.17,.035),cartilage,detail=True)
ell('Proximal tibia',(.02,-.02,.87),(.23,.17,.12),bone,detail=True)
o=ell('Tibial shaft',(.03,-.045,.03),(.095,.085,.80),bone,(0,-.025,0),True);grain(o,.009,14)
tube('Tibial crest',[(.08,-.11,.77),(.055,-.115,.30),(.02,-.105,-.35),(.00,-.08,-.77)],.022,bone)
tube('Fibular shaft',[(-.19,.04,.85),(-.17,.055,.30),(-.16,.05,-.30),(-.16,.02,-.80)],.038,bone)
ell('Fibular head',(-.18,.04,.77),(.072,.075,.10),bone)
ell('Lateral malleolus',(-.17,0,-.83),(.07,.08,.12),bone)
ell('Medial malleolus',(.12,-.025,-.78),(.075,.10,.11),bone)
for x,z,sx,sy,sz in [(-.24,.40,.16,.18,.48),(-.11,.40,.14,.19,.46),(-.24,.01,.13,.13,.38)]:
 ob=ell('Gastrocnemius and soleus',(x,.13,z),(sx,sy,sz),muscle,(0,-.06,0),True);grain(ob,.004,25)
 for n in range(15):
  a=-2.8+n*2.6/14;pts=[]
  for j in range(12):
   v=-.87+j*1.74/11;r=math.sqrt(max(0,1-v*v));pts.append((x+sx*r*math.cos(a),.13+sy*r*math.sin(a),z+sz*v))
  tube('Muscle fascicle',pts,.0035,fiber)
tube('Achilles tendon',[(-.17,.22,-.15),(-.13,.21,-.50),(-.08,.17,-.90),(-.06,.10,-1.04)],.044,tendon)
ell('Talus',(.00,-.04,-.92),(.16,.15,.12),bone,detail=True)
ell('Calcaneus',(-.015,.10,-1.08),(.17,.20,.14),bone,detail=True)
for i in range(3):ell('Tarsal bone',(-.13+i*.13,-.22,-1.06),(.095,.13,.085),bone)
for n in range(5):
 x=-.23+n*.115;length=.47-(.035*abs(n-2));end=-.37-length
 tube('Metatarsal',[(x*.55,-.30,-1.05),(x*.9,-.48,-1.10),(x,end,-1.13)],.035 if n else .047,bone)
 for k in range(3 if n else 2):
  y=end-.07-k*.075;ell('Toe phalanx',(x,y,-1.14),(.040 if n else .055,.055,.040),bone)
 tube('Extensor tendon',[(x*.20,-.08,-.55),(x*.55,-.28,-.95),(x*.9,-.53,-1.06),(x,end-.1,-1.095)],.010,tendon)
ell('Foot intrinsic muscle',(-.18,-.46,-1.12),(.075,.24,.06),muscle,(0,0,-.08))
tube('Tibialis anterior',[(.16,-.07,.72),(.17,-.09,.20),(.12,-.10,-.35)],.042,muscle)
tube('Anterior ankle tendon',[(.12,-.10,-.34),(.12,-.17,-.76),(.06,-.39,-1.00)],.023,tendon)
export('leg')
