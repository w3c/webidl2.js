type IDLIteratorMember = {
  type: 'iterator',
  getter: boolean,
  setter: boolean,
  creator: boolean,
  deleter: boolean,
  legacycaller: boolean,
  static: boolean,
  stringifier: boolean,
  idlType: IDLType|'void',
  iteratorObject?: string,
  extAttrs: Array<IDLExtendedAttribute>
};
