export class Fancy {
  private name: string;
  private count: number;

  constructor(name: string) {
    this.name = name;
    console.log(`Fancy constructor: ${name}`);
    this.count = 0;
  }

  addToCount(n: number): void {
    this.count += n;
  }

  getCount(): number {
    return this.count;
  }

  getName(): string {
    return this.name;
  }
}
