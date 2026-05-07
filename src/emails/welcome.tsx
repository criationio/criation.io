import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface WelcomeEmailProps {
  appUrl: string
  signupCredits: number
  expiresInDays: number
}

export function WelcomeEmail(props: WelcomeEmailProps) {
  const { appUrl, signupCredits, expiresInDays } = props
  return (
    <Html>
      <Head />
      <Preview>{`Bem-vindo ao Criation — voce ganhou ${signupCredits} creditos`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>Bem-vindo ao Criation</Heading>
          <Text style={paragraph}>
            Sua conta esta confirmada. Voce ganhou <strong>{signupCredits} creditos gratis</strong>{' '}
            para experimentar.
          </Text>
          <Text style={paragraph}>
            Os creditos expiram em {expiresInDays} dias. Use para sua primeira analise.
          </Text>
          <Section style={ctaWrap}>
            <Button href={`${appUrl}/estudio`} style={cta}>
              Fazer primeira analise
            </Button>
          </Section>
          <Text style={paragraphMuted}>Se voce nao criou esta conta, ignore este email.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = { backgroundColor: '#0a0a0f', fontFamily: 'system-ui, sans-serif' } as const
const container = { padding: '40px 20px', maxWidth: '560px', margin: '0 auto' } as const
const heading = { color: '#f4f4f5', fontSize: '24px', fontWeight: 700 } as const
const paragraph = { color: '#a1a1aa', fontSize: '15px', lineHeight: 1.6 } as const
const paragraphMuted = {
  color: '#71717a',
  fontSize: '13px',
  lineHeight: 1.6,
  marginTop: '32px',
} as const
const ctaWrap = { textAlign: 'center', margin: '32px 0' } as const
const cta = {
  backgroundColor: '#8b5cf6',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 500,
} as const

export default WelcomeEmail
