import { Expr } from './Expr';
import { Token } from './Token';

export interface StmtVisitor<R> {
  visitExpressionStmt(stmt: Stmt.Expression): R;
  visitPrintStmt(stmt: Stmt.Print): R;
  visitVarStmt(stmt: Stmt.Var): R;
  visitBlockStmt(stmt: Stmt.Block): R;
}

export abstract class Stmt {
  abstract accept<R>(visitor: StmtVisitor<R>): R;
}

export namespace Stmt {
  export class Expression extends Stmt {
    constructor(public readonly expression: Expr) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitExpressionStmt(this);
    }
  }

  export class Print extends Stmt {
    constructor(public readonly expression: Expr) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitPrintStmt(this);
    }
  }

  export class Var extends Stmt {
    constructor(
      public readonly name: Token,
      public readonly initializer: Expr | null,
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitVarStmt(this);
    }
  }

  export class Block extends Stmt {
    constructor(public readonly statements: Stmt[]) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitBlockStmt(this);
    }
  }
}
