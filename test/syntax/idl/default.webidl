// Extracted from https://heycam.github.io/webidl/#idl-operations (Example 13)
// on 2019-07-18

dictionary LookupOptions {
  boolean caseSensitive = false;
};

[Exposed=Window]
interface AddressBook {
  boolean hasAddressForName(USVString name, optional LookupOptions options = {});
};
