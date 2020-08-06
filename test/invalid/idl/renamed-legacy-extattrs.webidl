[Exposed=Window,
 NamedConstructor=TimeMachine(),
 NoInterfaceObject,
 OverrideBuiltins]
interface HTMLTimeCapsule : HTMLElement {
  [LenientSetter] readonly attribute DOMString lenientSetter;
  [LenientThis] readonly attribute DOMString lenientThis;
  attribute [TreatNullAs=EmptyString] DOMString treatNullAs;
  [Unforgeable] readonly attribute DOMString unforgeable;
};

[TreatNonObjectAsNull]
callback TreatsNonObjectAsNull = undefined (DOMString s);
