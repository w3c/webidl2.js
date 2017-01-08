type IDLDictionaryFieldMember = {
  type: 'field',
  name: string,
  required: boolean,
  idlType: IDLType,
  default?: IDLValue,
  extAttrs: Array<IDLExtendedAttribute>
};
