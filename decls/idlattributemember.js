type IDLAttributeMember = {
  type: 'attribute',
  static: boolean,
  stringifier: boolean,
  inherit: boolean,
  readonly: boolean,
  idlType: IDLType,
  name: string,
  extAttrs: Array<IDLExtendedAttribute>
};
