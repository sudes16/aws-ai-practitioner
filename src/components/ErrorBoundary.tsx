import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * React Error Boundary — catches render-phase exceptions and shows a
 * graceful fallback instead of a blank crash screen.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          errorMessage={this.state.errorMessage}
          onRetry={this.handleRetry}
        />
      );
    }
    return this.props.children;
  }
}

// Rendered outside ThemeProvider, so it reads the system scheme directly.
function ErrorFallback({ errorMessage, onRetry }: { errorMessage: string; onRetry: () => void }) {
  const isDark = useColorScheme() === 'dark';
  const c = {
    bg:      isDark ? '#0F1117' : '#F0F2F5',
    title:   isDark ? '#F3F4F6' : '#111827',
    message: isDark ? '#9CA3AF' : '#6B7280',
    devBg:   isDark ? '#3F1D1D' : '#FEF2F2',
    devText: isDark ? '#FCA5A5' : '#DC2626',
  };
  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={[styles.title, { color: c.title }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: c.message }]}>
        An unexpected error occurred. Your progress data is safe.
      </Text>
      {__DEV__ && (
        <Text
          style={[styles.devDetail, { color: c.devText, backgroundColor: c.devBg }]}
          numberOfLines={4}
        >
          {errorMessage}
        </Text>
      )}
      <TouchableOpacity
        style={styles.btn}
        onPress={onRetry}
        accessibilityLabel="Retry"
        accessibilityHint="Tap to reload the app"
      >
        <Text style={styles.btnText}>↩ Tap to Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  devDetail: {
    fontSize: 11,
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
    fontFamily: 'monospace',
  },
  btn: {
    backgroundColor: '#FF9900',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});
