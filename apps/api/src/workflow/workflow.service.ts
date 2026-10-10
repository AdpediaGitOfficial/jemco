import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "../common/decorators";

type Tx = Prisma.TransactionClient;

/**
 * The only way an NCR changes state. Checks `state_transitions` for the
 * actor's roles, writes the transition log, and updates the row (the DB
 * trigger re-checks the pair as a second line of defence).
 */
@Injectable()
export class WorkflowService {
  async transition(tx: Tx, ncrId: string, toState: string, actor: AuthUser, reason?: string) {
    const ncr = await tx.ncr.findUniqueOrThrow({ where: { id: ncrId } });
    const rule = await tx.stateTransition.findUnique({ where: { fromState_toState: { fromState: ncr.state, toState } } });
    if (!rule) throw new ForbiddenException(`cannot move from ${ncr.state} to ${toState}`);
    if (!rule.roles.some((r) => actor.roles.includes(r))) throw new ForbiddenException("your role cannot make this change");
    if (rule.reasonRequired && !reason?.trim()) throw new ForbiddenException("a reason is required");
    await tx.transitionLog.create({ data: { ncrId, fromState: ncr.state, toState, actorId: actor.id, reason } });
    return tx.ncr.update({ where: { id: ncrId }, data: { state: toState } });
  }
}
