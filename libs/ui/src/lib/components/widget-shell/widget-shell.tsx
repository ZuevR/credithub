import { Card, CardContent, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface WidgetShellProps {
  title: string;
  children: ReactNode;
}

export function WidgetShell({ title, children }: WidgetShellProps) {
  return (
    <Card elevation={0} variant="outlined">
      <CardContent>
        <Typography variant="h3" component="h2" sx={{ mb: 1.5 }}>
          {title}
        </Typography>
        {children}
      </CardContent>
    </Card>
  );
}
