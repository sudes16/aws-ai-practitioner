import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

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
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>
            An unexpected error occurred. Your progress data is safe.
          </Text>
          {__DEV__ && (
            <Text style={styles.devDetail} numberOfLines={4}>
              {this.state.errorMessage}
            </Text>
          )}
          <TouchableOpacity
            style={styles.btn}
            onPress={this.handleRetry}
            accessibilityLabel="Retry"
            accessibilityHint="Tap to reload the app"
          >
            <Text style={styles.btnText}>↩ Tap to Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  devDetail: {
    fontSize: 11,
    color: '#DC2626',
    backgroundColor: '#FEF2F2',
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
