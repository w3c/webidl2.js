type IDLType = {
  sequence: boolean,
  array: boolean|number,
  generic: ?string,
  idlType: IDLType|Array<IDLType>|PrimitiveType|string,
  nullable: boolean,
  nullableArray?: Array<boolean>,
  union: boolean
};
