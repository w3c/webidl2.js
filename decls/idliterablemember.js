type IDLIterableMember = {
  type: 'iterable',
  idlType: IDLType|[IDLType, IDLType],
  readonly: boolean,
  extAttrs: Array<IDLExtendedAttribute>
};
