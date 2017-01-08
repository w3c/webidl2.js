type IDLLegacyIterableMember = {
  type: 'legacyiterable',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};
