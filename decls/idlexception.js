type IDLException = {
  type: 'exception',
  name: string,
  members: Array<IDLConstantMember|IDLExceptionFieldMember>,
  inheritance: ?string,
  extAttrs: Array<IDLExtendedAttribute>
};
