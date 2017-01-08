declare class WebIDLParseError {
  message: string;
  line: number;
  input: string;
  tokens: Array<Token>;
};
