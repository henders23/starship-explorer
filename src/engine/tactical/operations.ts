import type { Point } from './mission.js'
export const OPERATION_KINDS = ['rescue', 'sabotage', 'salvage'] as const
export type OperationKind = typeof OPERATION_KINDS[number]
export interface Survivor extends Point { id: string; name: string; leader: string | null; evacuated: boolean }
export interface Operation {
  kind: OperationKind; survivors: Survivor[]; crates: (Point & { collected: boolean })[]
  alarm: boolean; reinforcement: boolean
}
export const OPERATION_BRIEFINGS: Record<OperationKind, { title: string; description: string; reward: string; warning: string; voice: string }> = {
  rescue: { title: 'Bring them home', description: 'Two surveyors are sheltering in separate wards. Reach each survivor, assign an escort, and lead them into the shuttle zone. One survivor can follow each operative.', reward: 'Normal cargo and science, plus 3 materials + 15 credits per survivor evacuated.', warning: 'Survivors follow every step and board as their escort reaches the shuttle. If the escort falls, another operative must reach them. Custodians target armed crew. Extracting ends the rescue; people still outside will be left behind.', voice: 'Mara: “We have two heartbeats. That is two people, not two targets on a display. Keep a path open.”' },
  sabotage: { title: 'Cut the watch', description: 'Disable the security uplink at the far end of the installation. The guarding custodians hold position until the uplink fails. Then they pursue the team.', reward: 'Normal cargo and science, plus 8 materials + 20 credits for disabling the uplink and extracting.', warning: 'Sabotage activates one reserve custodian on the next enemy turn. All surviving guards then advance up to four tiles. You can withdraw before touching the uplink.', voice: 'Sofia: “Cutting the uplink will not switch them off. It will take the leash off. Make sure we are ready to leave.”' },
  salvage: { title: 'One more crate', description: 'Three sealed cargo cases remain in the recovery hall. Collect any number, then extract. One case is enough to complete the job.', reward: 'Normal cargo and science, plus 5 materials + 8 credits per recovered case.', warning: 'At the end of turn 4 onward, exposed crew at column 5 or farther take 1 health damage; from turn 7 they take 2. Shields do not stop heat. Columns 1–4 stay safe. No countdown runs in real time.', voice: 'Idris: “The first case is an easy reach. The others are deeper in. We decide what the cargo is worth, not the other way around.”' },
}
export const operationArt = (kind: OperationKind) => `/assets/exploration/mission-${kind}.webp`
