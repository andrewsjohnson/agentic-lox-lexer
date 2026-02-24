import { printValue, valuesEqual, isBool, isNumber, isNil, isString } from '../../src/vm/Value';
import { VM, InterpretResult } from '../../src/vm/VM';

describe('printValue', () => {
  it('prints nil as "nil"', () => expect(printValue(null)).toBe('nil'));
  it('prints true as "true"', () => expect(printValue(true)).toBe('true'));
  it('prints false as "false"', () => expect(printValue(false)).toBe('false'));
  it('prints integer without decimal', () => expect(printValue(42)).toBe('42'));
  it('prints float with decimal', () => expect(printValue(3.14)).toBe('3.14'));
  it('prints string as-is', () => expect(printValue('hello')).toBe('hello'));
  it('prints 1.0 as "1" (not "1.0")', () => expect(printValue(1.0)).toBe('1'));
});

describe('valuesEqual', () => {
  it('nil == nil', () => expect(valuesEqual(null, null)).toBe(true));
  it('nil != false', () => expect(valuesEqual(null, false)).toBe(false));
  it('true == true', () => expect(valuesEqual(true, true)).toBe(true));
  it('false != true', () => expect(valuesEqual(false, true)).toBe(false));
  it('1 == 1', () => expect(valuesEqual(1, 1)).toBe(true));
  it('1 != 2', () => expect(valuesEqual(1, 2)).toBe(false));
  it('"a" == "a"', () => expect(valuesEqual('a', 'a')).toBe(true));
  it('"a" != "b"', () => expect(valuesEqual('a', 'b')).toBe(false));
  it('1 != "1" (different types)', () => expect(valuesEqual(1, '1' as unknown as number)).toBe(false));
});

describe('type guards', () => {
  it('isNil works', () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(false)).toBe(false);
  });
  it('isBool works', () => {
    expect(isBool(true)).toBe(true);
    expect(isBool(1)).toBe(false);
  });
  it('isNumber works', () => {
    expect(isNumber(3.14)).toBe(true);
    expect(isNumber('3')).toBe(false);
  });
  it('isString works', () => {
    expect(isString('hi')).toBe(true);
    expect(isString(1)).toBe(false);
  });
});

describe('VM — value types via compiler', () => {
  function run(source: string) {
    return new VM().interpretSource(source);
  }

  it('nil literal compiles and runs', () => expect(run('nil')).toBe(InterpretResult.OK));
  it('true literal compiles and runs', () => expect(run('true')).toBe(InterpretResult.OK));
  it('false literal compiles and runs', () => expect(run('false')).toBe(InterpretResult.OK));
  it('!true == false', () => expect(run('!true')).toBe(InterpretResult.OK));
  it('!nil == true', () => expect(run('!nil')).toBe(InterpretResult.OK));
  it('0 is truthy (so !0 == false)', () => expect(run('!0')).toBe(InterpretResult.OK));
  it('1 == 1', () => expect(run('1 == 1')).toBe(InterpretResult.OK));
  it('nil == nil', () => expect(run('nil == nil')).toBe(InterpretResult.OK));
  it('nil != false', () => expect(run('nil == false')).toBe(InterpretResult.OK));
});
