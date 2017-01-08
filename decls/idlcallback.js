type IDLCallback = {
  type: 'callback',
  name: string,
  idlType: IDLType|'void',
  arguments: Array<IDLArgument>,
  extAttrs: Array<IDLExtendedAttribute>
};
