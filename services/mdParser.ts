import { Task } from '../types';
import { addDays } from 'date-fns';

// This is a partial task type, as the ID will be assigned later.
type ParsedTaskData = Omit<Task, 'id' | 'predecessorId' | 'groupId'>;

const parseSingleMdFile = async (file: File): Promise<ParsedTaskData | null> => {
    try {
        const content = await file.text();
        const parts = content.split('---');

        // Expecting at least: an empty string and frontmatter. The body is no longer used.
        if (parts.length < 3) {
            console.warn(`Skipping file ${file.name}: Invalid Frontmatter format.`);
            return null;
        }

        const frontmatter = parts[1];
        
        // NEW: Task name is from the filename, without the extension.
        const name = file.name.replace(/\.(md|markdown|txt)$/i, '').trim();

        if (!name) {
            console.warn(`Skipping file ${file.name}: Could not determine task name from filename.`);
            return null;
        }

        // Parse scheduled date
        const scheduledMatch = frontmatter.match(/scheduled:\s*(\d{4}-\d{2}-\d{2})/);
        let startDate = new Date();
        if (scheduledMatch && scheduledMatch[1]) {
            const dateStr = scheduledMatch[1];
            startDate = new Date(dateStr + 'T00:00:00'); // Treat as local time midnight.
        }
        startDate.setHours(0, 0, 0, 0);

        // NEW: Parse time estimate (in seconds)
        const timeEstimateMatch = frontmatter.match(/timeEstimate:\s*(\d+)/);
        let timeEstimateInSeconds = 0;
        if (timeEstimateMatch && timeEstimateMatch[1]) {
            timeEstimateInSeconds = parseInt(timeEstimateMatch[1], 10);
        }

        // NEW: Calculate duration in days. A task of any duration > 0 should be at least 1 day long.
        // 86400 seconds in a day
        const durationInDays = Math.max(1, Math.ceil(timeEstimateInSeconds / 86400));
        
        // NEW: Calculate end date based on duration
        const endDate = addDays(startDate, durationInDays - 1);

        return {
            name: name,
            start: startDate,
            end: endDate,
            progress: 0,
        };
    } catch (error) {
        console.error(`Error parsing file ${file.name}:`, error);
        return null;
    }
};


export const parseMdFiles = async (files: File[]): Promise<ParsedTaskData[]> => {
  console.log(`Parsing ${files.length} MD files...`);
  
  const parsingPromises = files.map(parseSingleMdFile);
  const results = await Promise.all(parsingPromises);
  
  // Filter out any files that failed to parse (returned null)
  return results.filter((result): result is ParsedTaskData => result !== null);
};