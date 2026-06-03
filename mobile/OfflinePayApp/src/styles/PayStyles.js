import { StyleSheet } from 'react-native';


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  scroll: {
    padding: 24,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 20,
  },
  backText: {
    color: '#6366f1',
    fontSize: 16,
  },
  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 24,
  },
  progressCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 20,
    gap: 16,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  progressDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f0f23',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: {
    borderColor: '#6366f1',
    backgroundColor: '#1e1b4b',
  },
  progressDotDone: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  progressCheck: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressNum: {
    color: '#555',
    fontSize: 12,
  },
  progressLabel: {
    color: '#555',
    fontSize: 14,
  },
  progressLabelActive: {
    color: 'white',
    fontWeight: '600',
  },
  progressLabelDone: {
    color: '#22c55e',
  },
  form: {
    backgroundColor: '#1a1a3e',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 20,
  },
  label: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 4,
  },
  hint: {
    color: '#666',
    fontSize: 12,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f0f23',
    borderRadius: 12,
    padding: 14,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  amountInput: {
    backgroundColor: '#0f0f23',
    borderRadius: 12,
    padding: 20,
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    textAlign: 'center',
    marginTop: 4,
  },
  sendBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sendBtnText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  infoTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 10,
    fontSize: 15,
  },
  infoText: {
    color: '#888',
    lineHeight: 24,
    fontSize: 13,
  },
});

export default styles;