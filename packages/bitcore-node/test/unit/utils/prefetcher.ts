import { describe } from 'mocha';
import { expect } from 'chai';
import { Prefetcher } from "../../../src/utils/prefetcher";

describe("Prefetcher", () => {

  it("should get one at a time", async () => {
    let args = [1, 2, 3, 4, 5];
    let pointer = args[0];
    let incrementTest = (arg: number) => {
      expect(pointer === arg);
      pointer++;
      return arg;
    };
    let testPrefetcher = new Prefetcher<number, number>(args, 1, incrementTest);
    for(let arg of args ) {
      let result = await testPrefetcher.get(arg);
      expect(result === arg);
      expect(pointer === arg);
    }
  })

  it("should get two ahead", async () => {
    let args = [1, 2, 3, 4, 5, 6];
    let pointer = 0;
    let incrementTest = (arg: number) => {
      pointer++;
      return arg;
    };
    let testPrefetcher = new Prefetcher<number, number>(args, 2, incrementTest);
    expect(pointer).eq(2);
    expect(await testPrefetcher.get(1)).eq(1);
    expect(pointer).eq(2);
    expect(await testPrefetcher.get(2)).eq(2);
    expect(pointer).eq(5);
    expect(await testPrefetcher.get(3)).eq(3);
    expect(pointer).eq(5);
    expect(await testPrefetcher.get(4)).eq(4);
    expect(pointer).eq(5);
    expect(await testPrefetcher.get(5)).eq(5);
    expect(pointer).eq(6);
    expect(await testPrefetcher.get(6)).eq(6);
  })
});
