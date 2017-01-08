type IDLSetlikeMember = {
  type: 'setlike',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};
