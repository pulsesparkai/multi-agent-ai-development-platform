import { api, APIError } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import db from "../db";
import { v4 as uuidv4 } from "uuid";
import {
  RoleAssignmentRequest,
  RoleAssignmentRule,
  CreateRoleRuleRequest,
  ProjectRequirement,
  AgentRole,
  RoleTrigger,
  Agent
} from "./types";

// Analyzes project requirements and assigns optimal roles to agents
export const assignRoles = api<RoleAssignmentRequest & { teamId: string }, { assignments: { agentId: string; newRole: AgentRole; reason: string }[] }>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/teams/:teamId/assign-roles" },
  async ({ teamId, projectRequirements, currentWorkload, sessionContext }) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    // Get all agents in the team that can adapt roles
    const agents = await db.queryAll<Agent>`
      SELECT id, team_id as "teamId", name, role, current_role as "currentRole",
             can_adapt_role as "canAdaptRole", available_roles as "availableRoles",
             persona_id as "personaId", execution_order as "executionOrder"
      FROM agents
      WHERE team_id = ${teamId} AND can_adapt_role = true AND is_enabled = true
      ORDER BY execution_order
    `;

    const assignments: { agentId: string; newRole: AgentRole; reason: string }[] = [];

    // Apply role assignment logic based on project requirements
    for (const agent of agents) {
      const optimalRole = determineOptimalRole(agent, projectRequirements, currentWorkload, sessionContext);
      
      if (optimalRole && optimalRole !== agent.currentRole && agent.availableRoles.includes(optimalRole)) {
        assignments.push({
          agentId: agent.id,
          newRole: optimalRole,
          reason: generateRoleChangeReason(agent.currentRole, optimalRole, projectRequirements)
        });

        // Update agent's current role
        await db.exec`
          UPDATE agents
          SET current_role = ${optimalRole}, updated_at = NOW()
          WHERE id = ${agent.id}
        `;

        // Record the role change in history
        await db.exec`
          INSERT INTO role_assignment_history (agent_id, from_role, to_role, trigger, trigger_context)
          VALUES (${agent.id}, ${agent.currentRole}, ${optimalRole}, 'manual', ${JSON.stringify({ projectRequirements, sessionContext })})
        `;
      }
    }

    return { assignments };
  }
);

// Creates a new role assignment rule
export const createRoleRule = api<CreateRoleRuleRequest, RoleAssignmentRule>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/role-rules" },
  async (req) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${req.teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const ruleId = uuidv4();

    await db.exec`
      INSERT INTO role_assignment_rules (id, team_id, project_type, trigger, from_role, to_role, condition, priority)
      VALUES (${ruleId}, ${req.teamId}, ${req.projectType || null}, ${req.trigger}, ${req.fromRole}, ${req.toRole}, ${req.condition}, ${req.priority || 0})
    `;

    const rule = await db.queryRow<RoleAssignmentRule>`
      SELECT id, team_id as "teamId", project_type as "projectType", trigger, from_role as "fromRole",
             to_role as "toRole", condition, priority, is_enabled as "isEnabled",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM role_assignment_rules
      WHERE id = ${ruleId}
    `;

    if (!rule) {
      throw APIError.internal("failed to create role rule");
    }

    return rule;
  }
);

// Lists role assignment rules for a team
export const listRoleRules = api<{ teamId: string }, { rules: RoleAssignmentRule[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/teams/:teamId/role-rules" },
  async ({ teamId }) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const rules = await db.queryAll<RoleAssignmentRule>`
      SELECT id, team_id as "teamId", project_type as "projectType", trigger, from_role as "fromRole",
             to_role as "toRole", condition, priority, is_enabled as "isEnabled",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM role_assignment_rules
      WHERE team_id = ${teamId}
      ORDER BY priority DESC, created_at ASC
    `;

    return { rules };
  }
);

// Automatically triggers role reassignment based on session events
export const triggerRoleReassignment = api<{ 
  teamId: string; 
  trigger: RoleTrigger; 
  context: any 
}, { reassignments: { agentId: string; newRole: AgentRole; reason: string }[] }>(
  { auth: true, expose: true, method: "POST", path: "/multiagent/teams/:teamId/trigger-reassignment" },
  async ({ teamId, trigger, context }) => {
    const auth = getAuthData()!;

    // Get applicable rules for this trigger
    const rules = await db.queryAll<RoleAssignmentRule>`
      SELECT id, from_role as "fromRole", to_role as "toRole", condition
      FROM role_assignment_rules
      WHERE team_id = ${teamId} AND trigger = ${trigger} AND is_enabled = true
      ORDER BY priority DESC
    `;

    const reassignments: { agentId: string; newRole: AgentRole; reason: string }[] = [];

    for (const rule of rules) {
      // Find agents matching the from_role and evaluate condition
      const agents = await db.queryAll<Agent>`
        SELECT id, current_role as "currentRole", available_roles as "availableRoles"
        FROM agents
        WHERE team_id = ${teamId} AND current_role = ${rule.fromRole} 
              AND can_adapt_role = true AND is_enabled = true
      `;

      for (const agent of agents) {
        if (evaluateRuleCondition(rule.condition, context) && agent.availableRoles.includes(rule.toRole)) {
          // Update agent role
          await db.exec`
            UPDATE agents
            SET current_role = ${rule.toRole}, updated_at = NOW()
            WHERE id = ${agent.id}
          `;

          // Record in history
          await db.exec`
            INSERT INTO role_assignment_history (agent_id, from_role, to_role, trigger, trigger_context)
            VALUES (${agent.id}, ${rule.fromRole}, ${rule.toRole}, ${trigger}, ${JSON.stringify(context)})
          `;

          reassignments.push({
            agentId: agent.id,
            newRole: rule.toRole,
            reason: `${trigger} triggered role change: ${rule.condition}`
          });
        }
      }
    }

    return { reassignments };
  }
);

// Get role assignment history for a team
export const getRoleHistory = api<{ teamId: string }, { history: any[] }>(
  { auth: true, expose: true, method: "GET", path: "/multiagent/teams/:teamId/role-history" },
  async ({ teamId }) => {
    const auth = getAuthData()!;

    // Verify team ownership
    const team = await db.queryRow`
      SELECT id FROM agent_teams
      WHERE id = ${teamId} AND user_id = ${auth.userID}
    `;

    if (!team) {
      throw APIError.notFound("team not found");
    }

    const history = await db.queryAll`
      SELECT h.id, h.agent_id as "agentId", a.name as "agentName",
             h.from_role as "fromRole", h.to_role as "toRole", h.trigger,
             h.trigger_context as "triggerContext", h.assigned_at as "assignedAt"
      FROM role_assignment_history h
      JOIN agents a ON h.agent_id = a.id
      WHERE a.team_id = ${teamId}
      ORDER BY h.assigned_at DESC
      LIMIT 100
    `;

    return { history };
  }
);

// Helper function to determine optimal role based on project requirements
function determineOptimalRole(
  agent: Agent,
  requirements: ProjectRequirement,
  workload: { [agentId: string]: number },
  context: string
): AgentRole | null {
  const agentWorkload = workload[agent.id] || 0;
  
  // If agent is overloaded, suggest coordinator role
  if (agentWorkload > 0.8) {
    return agent.availableRoles.includes('coordinator') ? 'coordinator' : null;
  }

  // Role assignment based on project complexity and domains
  switch (requirements.complexity) {
    case 'high':
      if (requirements.domains.includes('backend') && agent.availableRoles.includes('coder')) {
        return 'coder';
      }
      if (requirements.domains.includes('testing') && agent.availableRoles.includes('tester')) {
        return 'tester';
      }
      break;
      
    case 'medium':
      if (agent.currentRole === 'planner' && agent.availableRoles.includes('reviewer')) {
        return 'reviewer';
      }
      break;
      
    case 'low':
      if (agent.currentRole === 'coder' && agent.availableRoles.includes('tester')) {
        return 'tester';
      }
      break;
  }

  // Context-based role assignment
  if (context.toLowerCase().includes('bug') && agent.availableRoles.includes('tester')) {
    return 'tester';
  }
  if (context.toLowerCase().includes('review') && agent.availableRoles.includes('reviewer')) {
    return 'reviewer';
  }
  if (context.toLowerCase().includes('plan') && agent.availableRoles.includes('planner')) {
    return 'planner';
  }

  return null;
}

// Helper function to generate role change reason
function generateRoleChangeReason(fromRole: AgentRole, toRole: AgentRole, requirements: ProjectRequirement): string {
  const reasons = {
    'planner->coder': 'Project requires immediate implementation',
    'coder->tester': 'Implementation phase complete, moving to testing',
    'tester->reviewer': 'Testing complete, conducting final review',
    'reviewer->coordinator': 'Managing team coordination and workflow',
    'coordinator->planner': 'New planning phase required'
  };

  const key = `${fromRole}->${toRole}` as keyof typeof reasons;
  return reasons[key] || `Role adapted based on ${requirements.complexity} complexity project requirements`;
}

// Helper function to evaluate rule conditions
function evaluateRuleCondition(condition: string, context: any): boolean {
  try {
    // Simple condition evaluation - could be enhanced with a proper expression parser
    if (condition.includes('error_rate >')) {
      const threshold = parseFloat(condition.split('>')[1].trim());
      return context.errorRate > threshold;
    }
    
    if (condition.includes('iteration >')) {
      const threshold = parseInt(condition.split('>')[1].trim());
      return context.iteration > threshold;
    }
    
    if (condition.includes('complexity ==')) {
      const value = condition.split('==')[1].trim().replace(/['"]/g, '');
      return context.complexity === value;
    }

    // Default to true for simple conditions
    return true;
  } catch (error) {
    return false;
  }
}