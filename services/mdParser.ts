import { Task } from '../types';

// This is a partial task type, as the ID will be assigned later.
type ParsedTaskData = Omit<Task, 'id' | 'predecessorId' | 'groupId'>;

const parseSingleMdFile = async (file: File): Promise<ParsedTaskData | null> => {
    try {
        const content = await file.text();
        const parts = content.split('---');

        // Expecting: an empty string, frontmatter, and body content
        if (parts.length < 3) {
            console.warn(`Skipping file ${file.name}: Invalid Frontmatter format.`);
            return null;
        }

        const frontmatter = parts[1];
        const name = parts.slice(2).join('---').trim();

        const scheduledMatch = frontmatter.match(/scheduled:\s*(\d{4}-\d{2}-\d{2})/);

        if (!name) {
            console.warn(`Skipping file ${file.name}: Task name (body) is empty.`);
            return null;
        }

        // Use today's date if 'scheduled' is not found.
        let taskDate = new Date();
        if (scheduledMatch && scheduledMatch[1]) {
             // new Date('YYYY-MM-DD') can have timezone issues.
             // It creates the date at UTC midnight. When formatted in a local timezone, it might be the day before.
             // To fix this, we can add the timezone offset or parse manually.
            const dateStr = scheduledMatch[1];
            taskDate = new Date(dateStr + 'T00:00:00'); // Treat as local time midnight.
        }
        
        taskDate.setHours(0, 0, 0, 0);


        return {
            name: name,
            start: taskDate,
            end: taskDate, // The requirement doesn't specify an end date, so we make it a single-day task.
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
