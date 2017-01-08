type IDLOperationMember = {
  type: 'operation',
  getter: boolean,
  setter: boolean,
  creator: boolean,
  deleter: boolean,
  legacycaller: boolean,
  static: boolean,
  stringifier: boolean,
  idlType?: IDLType|'void',
  name: ?string,
  arguments: Array<IDLArgument>,
  extAttrs: Array<IDLExtendedAttribute>
};
