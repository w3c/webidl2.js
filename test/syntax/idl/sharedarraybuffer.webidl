[Exposed=Window]
interface Foo {
    undefined foo(SharedArrayBuffer buffer);
    undefined foo(AllowSharedBufferSource source);
};
