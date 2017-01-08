type IDLConstantMember = {
  type: 'const',
  nullable: boolean,
  idlType: PrimitiveType|string,
  value: IDLValue,
  extAttrs: Array<IDLExtendedAttribute>
};
