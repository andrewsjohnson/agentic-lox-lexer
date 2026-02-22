import { Expr } from './Expr';
import { Token } from './Token';

export interface StmtVisitor<R> {
  visitExpressionStmt(stmt: Stmt.Expression): R;
  visitPrintStmt(stmt: Stmt.Print): R;
  visitVarStmt(stmt: Stmt.Var): R;
  visitBlockStmt(stmt: Stmt.Block): R;
  visitIfStmt(stmt: Stmt.If): R;
  visitWhileStmt(stmt: Stmt.While): R;
  visitFunctionStmt(stmt: Stmt.Function): R;
  visitReturnStmt(stmt: Stmt.Return): R;
  visitClassStmt(stmt: Stmt.Class): R;
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

  export class If extends Stmt {
    constructor(
      public readonly condition: Expr,
      public readonly thenBranch: Stmt,
      public readonly elseBranch: Stmt | null,
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitIfStmt(this);
    }
  }

  export class While extends Stmt {
    constructor(
      public readonly condition: Expr,
      public readonly body: Stmt,
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitWhileStmt(this);
    }
  }

  export class Function extends Stmt {
    constructor(
      public readonly name: Token,
      public readonly params: Token[],
      public readonly body: Stmt[],
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitFunctionStmt(this);
    }
  }

  export class Return extends Stmt {
    constructor(
      public readonly keyword: Token,
      public readonly value: Expr | null,
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitReturnStmt(this);
    }
  }

  export class Class extends Stmt {
    constructor(
      public readonly name: Token,
      public readonly methods: Stmt.Function[],
    ) {
      super();
    }

    accept<R>(visitor: StmtVisitor<R>): R {
      return visitor.visitClassStmt(this);
    }
  }
}
