export function historical(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
  descriptor.value.category = 'archive';
}

export function realtime(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
  descriptor.value.category = 'realtime';
}

export function internal(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
  descriptor.value.scope = 'internal';
}

export function external(_target: any, _propertyKey: string | symbol, descriptor: PropertyDescriptor) {
  descriptor.value.scope = 'external';
}