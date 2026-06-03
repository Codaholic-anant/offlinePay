import { StyleSheet } from 'react-native';


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
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
    lineHeight: 20,
  },
  ipCard: {
    backgroundColor: '#1e1b4b',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366f1',
    marginBottom: 16,
  },
  ipLabel: {
    color: '#818cf8',
    fontSize: 13,
    marginBottom: 8,
  },
  ipAddress: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  ipHint: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
  },
  balanceCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
  },
  balanceLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 4,
  },
  balanceAmount: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    marginBottom: 16,
    gap: 12,
  },
  statusCardActive: {
    borderColor: '#22c55e',
    backgroundColor: '#052e16',
  },
  statusIcon: {
    fontSize: 20,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  listenBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  listenBtnStop: {
    backgroundColor: '#7f1d1d',
  },
  listenBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  paymentCard: {
    backgroundColor: '#052e16',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 16,
    alignItems: 'center',
  },
  paymentTitle: {
    color: '#22c55e',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  paymentAmount: {
    color: '#22c55e',
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  paymentFrom: {
    color: '#888',
    fontSize: 14,
    marginBottom: 4,
  },
  paymentNew: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
    lineHeight: 26,
    fontSize: 13,
  },
});

export default styles;