type IDLArgument = {
  optional: boolean,
  variadic: boolean,
  extAttrs: Array<IDLExtendedAttribute>,
  idlType: IDLType,
  name: string,
  default?: IDLValue
};
