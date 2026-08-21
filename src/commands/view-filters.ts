import { 
  getFilterState, 
  updateFilterState, 
  resetFilterState, 
  type FilterState 
} from '../platform/view-state.js';

/**
 * MCP tool parameters for driving the dashboard's filters
 */
interface DashboardFilterParams {
  action: 'read' | 'update';
  keyword?: string;
  applied?: 'all' | 'applied' | 'not-applied';
  verdict?: 'all' | 'yes' | 'maybe' | 'no' | 'unrated';
  country?: string;
  pay?: 'all' | 'with-pay';
  reset?: boolean;
}

/**
 * Handle MCP tool call for reading or updating the dashboard's filters
 */
export async function handleDashboardFilters(params: DashboardFilterParams): Promise<{
  content: Array<{ type: string; text: string }>;
}> {
  try {
    if (params.action === 'read') {
      return {
        content: [{
          type: "text",
          text: `Current dashboard filters:\n${formatFilterState(getFilterState())}`
        }]
      };
    }
    
    if (params.action === 'update') {
      if (params.reset) {
        const defaultState = resetFilterState();
        return {
          content: [{
            type: "text",
            text: `All filters cleared.\n\nCurrent dashboard filters:\n${formatFilterState(defaultState)}`
          }]
        };
      }
      
      const updates: Partial<FilterState> = {};
      
      if (params.keyword !== undefined) updates.keywordFilter = params.keyword;
      if (params.applied !== undefined) updates.appliedFilter = params.applied;
      if (params.verdict !== undefined) updates.verdictFilter = params.verdict;
      if (params.country !== undefined) updates.countryFilter = params.country;
      if (params.pay !== undefined) updates.payFilter = params.pay;
      
      if (Object.keys(updates).length === 0) {
        return {
          content: [{
            type: "text",
            text: `No filter values supplied. Use action 'read' to see the current filters, or pass one or more filter values to change them.`
          }]
        };
      }
      
      const newState = updateFilterState(updates);
      
      const changed: string[] = [];
      if (updates.keywordFilter !== undefined) changed.push(`- Keyword: ${updates.keywordFilter || 'all keywords'}`);
      if (updates.appliedFilter !== undefined) changed.push(`- Application: ${formatApplied(updates.appliedFilter)}`);
      if (updates.verdictFilter !== undefined) changed.push(`- Verdict: ${formatVerdict(updates.verdictFilter)}`);
      if (updates.countryFilter !== undefined) changed.push(`- Country: ${updates.countryFilter || 'all countries'}`);
      if (updates.payFilter !== undefined) changed.push(`- Pay: ${updates.payFilter === 'with-pay' ? 'only posts quoting pay' : 'any'}`);
      
      return {
        content: [{
          type: "text",
          text: `Filters updated.\n\nChanged:\n${changed.join('\n')}\n\nCurrent dashboard filters:\n${formatFilterState(newState)}\n\nThe dashboard picks this up within a couple of seconds.`
        }]
      };
    }
    
    throw new Error(`Invalid action: ${params.action}. Use 'read' or 'update'.`);
    
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Failed to change filters: ${error instanceof Error ? error.message : 'Unknown error'}`
      }]
    };
  }
}

/**
 * Format filter state for display
 */
function formatFilterState(state: FilterState): string {
  return [
    `  - Keyword: ${state.keywordFilter || 'all keywords'}`,
    `  - Country: ${state.countryFilter || 'all countries'}`,
    `  - Verdict: ${formatVerdict(state.verdictFilter)}`,
    `  - Application: ${formatApplied(state.appliedFilter)}`,
    `  - Pay: ${state.payFilter === 'with-pay' ? 'only posts quoting pay' : 'any'}`
  ].join('\n');
}

function formatApplied(filter: FilterState['appliedFilter']): string {
  switch (filter) {
    case 'all': return 'any';
    case 'applied': return 'applied only';
    case 'not-applied': return 'not applied yet';
  }
}

function formatVerdict(filter: FilterState['verdictFilter']): string {
  switch (filter) {
    case 'all': return 'any';
    case 'yes': return 'interested';
    case 'maybe': return 'maybe';
    case 'no': return 'not interested';
    case 'unrated': return 'not yet rated';
  }
}
