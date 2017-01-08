type IDLCallbackInterface = {
  type: 'callback interface',
  name: string,
  partial: boolean,
  members: Array<IDLMember>,
  inheritance: ?string,
  extAttrs: Array<IDLExtendedAttribute>
};
