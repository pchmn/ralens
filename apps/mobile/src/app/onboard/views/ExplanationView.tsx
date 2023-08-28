import { Flex, Text } from '@ralens/react-native';
import { ReactNode } from 'react';

export function ExplanationView({
  image,
  title,
  description,
}: {
  image: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Flex flex={1} paddingY={60} justify="space-between">
      <Flex flex={1} align="center" justify="center">
        {image}
      </Flex>
      <Flex align="center" justify="center" gap={50} width="100%" style={{ alignSelf: 'flex-end' }}>
        <Flex gap={20}>
          <Text variant="headlineMedium">{title}</Text>
          <Text variant="bodyMedium" style={{ opacity: 0.75, lineHeight: 25 }}>
            {description}
          </Text>
        </Flex>
      </Flex>
    </Flex>
  );
}
