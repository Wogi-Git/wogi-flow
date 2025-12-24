import type { Meta, StoryObj } from '@storybook/react';
import { [ComponentName] } from './[ComponentName]';

const meta: Meta<typeof [ComponentName]> = {
  title: 'Components/[ComponentName]',
  component: [ComponentName],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Add argTypes based on props
    // variant: {
    //   control: 'select',
    //   options: ['primary', 'secondary'],
    // },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    // Add default props
  },
};

// Variant stories
// export const Primary: Story = {
//   args: {
//     variant: 'primary',
//   },
// };

// export const Secondary: Story = {
//   args: {
//     variant: 'secondary',
//   },
// };

// Interactive story
// export const Interactive: Story = {
//   args: {},
//   play: async ({ canvasElement }) => {
//     // Add interaction tests
//   },
// };
