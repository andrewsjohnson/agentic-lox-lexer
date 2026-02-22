import { Token } from './Token';

export type LoxLiteral = string | number | boolean | null;

export interface Visitor<R> {
  visitBinaryExpr(expr: Expr.Binary): R;
  visitGroupingExpr(expr: Expr.Grouping): R;
  visitLiteralExpr(expr: Expr.Literal): R;
  visitUnaryExpr(expr: Expr.Unary): R;
  visitVariableExpr(expr: Expr.Variable): R;
  visitAssignExpr(expr: Expr.Assign): R;
  visitLogicalExpr(expr: Expr.Logical): R;
  visitCallExpr(expr: Expr.Call): R;
  visitGetExpr(expr: Expr.Get): R;
  visitSetExpr(expr: Expr.Set): R;
  visitThisExpr(expr: Expr.This): R;
  visitSuperExpr(expr: Expr.Super): R;
}

export abstract class Expr {
  abstract accept<R>(visitor: Visitor<R>): R;
}

export namespace Expr {
  export class Binary extends Expr {
    constructor(
      public readonly left: Expr,
      public readonly operator: Token,
      public readonly right: Expr,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitBinaryExpr(this);
    }
  }

  export class Grouping extends Expr {
    constructor(public readonly expression: Expr) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitGroupingExpr(this);
    }
  }

  export class Literal extends Expr {
    constructor(public readonly value: LoxLiteral) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitLiteralExpr(this);
    }
  }

  export class Unary extends Expr {
    constructor(
      public readonly operator: Token,
      public readonly right: Expr,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitUnaryExpr(this);
    }
  }

  export class Variable extends Expr {
    constructor(public readonly name: Token) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitVariableExpr(this);
    }
  }

  export class Assign extends Expr {
    constructor(
      public readonly name: Token,
      public readonly value: Expr,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitAssignExpr(this);
    }
  }

  export class Logical extends Expr {
    constructor(
      public readonly left: Expr,
      public readonly operator: Token,
      public readonly right: Expr,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitLogicalExpr(this);
    }
  }

  export class Call extends Expr {
    constructor(
      public readonly callee: Expr,
      public readonly paren: Token,
      public readonly args: Expr[],
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitCallExpr(this);
    }
  }

  export class Get extends Expr {
    constructor(
      public readonly object: Expr,
      public readonly name: Token,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitGetExpr(this);
    }
  }

  export class Set extends Expr {
    constructor(
      public readonly object: Expr,
      public readonly name: Token,
      public readonly value: Expr,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitSetExpr(this);
    }
  }

  export class This extends Expr {
    constructor(public readonly keyword: Token) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitThisExpr(this);
    }
  }

  export class Super extends Expr {
    constructor(
      public readonly keyword: Token,
      public readonly method: Token,
    ) {
      super();
    }

    accept<R>(visitor: Visitor<R>): R {
      return visitor.visitSuperExpr(this);
    }
  }
}
