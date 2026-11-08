import type { RobotHand } from "./robot-hand";
import type { Interaction } from "./interaction";
import type { ControlHand } from "./control-core";
export function applyHandControl(
  robot: RobotHand,
  world: Interaction,
  command: ControlHand,
  dt: number,
) {
  if (!command.enabled) return;
  robot.active = true;
  robot.target.set(command.target.x, command.target.y, command.target.z);
  robot.pose(command, command.reference);
  robot.update(dt);
  robot.position.copy(
    world.constrainMotion(
      robot.side,
      robot.position,
      robot.palm.quaternion,
      robot.contactPoints(),
    ),
  );
  robot.update(0);
  world.updateHand(robot.side, robot.position, command.grip, 0, {
    quaternion: robot.palm.quaternion,
    point: robot.graspPoint(),
    camera: true,
  });
  const held = world.held(robot.side);
  if (held)
    robot.avoidHeld((point) =>
      world.penetration(point, 0.025, held).lengthSq(),
    );
}
