import struct,zlib,sys,os
class Node:
 def __init__(self,name,props,children): self.name=name; self.props=props; self.children=children
 def child(self,n): return [c for c in self.children if c.name==n]

def parse_prop(data, pos):
 t=chr(data[pos]); pos+=1
 if t=='Y': return struct.unpack_from('<h',data,pos)[0],pos+2
 if t=='C': return data[pos]!=0,pos+1
 if t=='I': return struct.unpack_from('<i',data,pos)[0],pos+4
 if t=='F': return struct.unpack_from('<f',data,pos)[0],pos+4
 if t=='D': return struct.unpack_from('<d',data,pos)[0],pos+8
 if t=='L': return struct.unpack_from('<q',data,pos)[0],pos+8
 if t in 'fdlib':
  n,enc,clen=struct.unpack_from('<III',data,pos); pos+=12
  raw=data[pos:pos+clen]; pos+=clen
  if enc: raw=zlib.decompress(raw)
  fmts={'f':'<%df'%n,'d':'<%dd'%n,'l':'<%dq'%n,'i':'<%di'%n,'b':'<%dB'%n}
  vals=list(struct.unpack(fmts[t],raw[:struct.calcsize(fmts[t])]))
  return vals,pos
 if t in 'SR':
  n=struct.unpack_from('<I',data,pos)[0]; pos+=4
  raw=data[pos:pos+n];pos+=n
  if t=='S':
   try:return raw.decode('utf-8','replace'),pos
   except:return raw,pos
  return raw,pos
 raise ValueError('unknown prop '+repr(t)+' @'+str(pos-1))

def parse_nodes(data):
 version=struct.unpack_from('<I',data,23)[0]
 wide=version>=7500
 pos=27
 def node_at(pos):
  if wide:
   end,nprops,plen=struct.unpack_from('<QQQ',data,pos); h=25
  else:
   end,nprops,plen=struct.unpack_from('<III',data,pos); h=13
  name_len=data[pos+h-1]
  if end==0: return None,pos+h
  name=data[pos+h:pos+h+name_len].decode('utf-8','replace')
  p=pos+h+name_len
  props=[]
  for _ in range(nprops):
   v,p=parse_prop(data,p); props.append(v)
  children=[]
  null_len=25 if wide else 13
  while p<end-null_len:
   ch,np=node_at(p)
   if ch is None: break
   children.append(ch); p=np
  return Node(name,props,children),end
 roots=[]
 while pos<len(data):
  n,np=node_at(pos)
  if n is None: break
  roots.append(n);pos=np
 return version,roots

def walk(n,d=0):
 print('  '*d+n.name, n.props[:4], 'children',len(n.children))
 for c in n.children[:100]: walk(c,d+1)

if __name__=='__main__':
 p=sys.argv[1]
 data=open(p,'rb').read();v,roots=parse_nodes(data);print('version',v,'roots',[(r.name,len(r.children),r.props[:2]) for r in roots])
 for r in roots:
  if r.name in ('Objects','Connections','GlobalSettings','Takes'):
   print('\n##',r.name)
   for c in r.children[:300]:
    print(c.name,c.props[:5],'children',len(c.children))
