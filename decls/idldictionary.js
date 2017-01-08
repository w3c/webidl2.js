type IDLDictionary = {
  type: 'dictionary',
  name: string,
  partial: boolean,
  members: Array<IDLDictionaryFieldMember>,
  inheritance: ?string,
  extAttrs: Array<IDLExtendedAttribute>
};
