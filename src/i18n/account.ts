// Strings for: account. English is the source; every other language should have the same keys.
const en = {
  errorTitle: 'Something went wrong',
  tryAgain: 'Try again.',
  notSetUp: 'Accounts aren’t set up in this build yet.',
  signInPitch: 'Sign in to get {credits}, buy more, and back up your progress.',
  freeCredits: '50 free AI credits',
  appleUnavailable: 'Sign in with Apple isn’t available on this device.',
  signedIn: 'SIGNED IN',
  emailHidden: 'Apple ID (email hidden)',
  getMoreCredits: 'GET MORE CREDITS',
  backUpNow: 'BACK UP NOW',
  signOut: 'SIGN OUT',
  backedUpAt: 'Backed up {time}',
  autoBackup: 'Your data backs up automatically while signed in.',
  deleteTitle: 'Delete your account?',
  deleteBody:
    'This permanently deletes your Pulse account, your remaining credits and your cloud backup. Your logs stay on this phone. An active Pulse Pro subscription must be cancelled in your Apple ID settings.',
  cancel: 'Cancel',
  deleteAccount: 'Delete account',
  deleting: 'Deleting…',
} as const;

const es: Partial<Record<keyof typeof en, string>> = {
  errorTitle: 'Algo salió mal',
  tryAgain: 'Inténtalo de nuevo.',
  notSetUp: 'Las cuentas aún no están configuradas en esta versión.',
  signInPitch: 'Inicia sesión para conseguir {credits}, comprar más y respaldar tu progreso.',
  freeCredits: '50 créditos de IA gratis',
  appleUnavailable: 'Iniciar sesión con Apple no está disponible en este dispositivo.',
  signedIn: 'SESIÓN INICIADA',
  emailHidden: 'Apple ID (email oculto)',
  getMoreCredits: 'CONSEGUIR MÁS CRÉDITOS',
  backUpNow: 'RESPALDAR YA',
  signOut: 'CERRAR SESIÓN',
  backedUpAt: 'Respaldado: {time}',
  autoBackup: 'Tus datos se respaldan solos mientras tengas la sesión iniciada.',
  deleteTitle: '¿Eliminar tu cuenta?',
  deleteBody:
    'Esto elimina para siempre tu cuenta de Pulse, tus créditos restantes y tu copia en la nube. Tus registros se quedan en este teléfono. Una suscripción activa a Pulse Pro debe cancelarse en los ajustes de tu Apple ID.',
  cancel: 'Cancelar',
  deleteAccount: 'Eliminar cuenta',
  deleting: 'Eliminando…',
};

const de: Partial<Record<keyof typeof en, string>> = {
  errorTitle: 'Etwas ist schiefgelaufen',
  tryAgain: 'Versuch’s nochmal.',
  notSetUp: 'Konten sind in diesem Build noch nicht eingerichtet.',
  signInPitch: 'Melde dich an für {credits}, kauf mehr und sichere deinen Fortschritt.',
  freeCredits: '50 gratis KI-Credits',
  appleUnavailable: 'Mit Apple anmelden ist auf diesem Gerät nicht verfügbar.',
  signedIn: 'ANGEMELDET',
  emailHidden: 'Apple-ID (E-Mail verborgen)',
  getMoreCredits: 'MEHR CREDITS HOLEN',
  backUpNow: 'JETZT SICHERN',
  signOut: 'ABMELDEN',
  backedUpAt: 'Gesichert: {time}',
  autoBackup: 'Deine Daten werden automatisch gesichert, solange du angemeldet bist.',
  deleteTitle: 'Konto löschen?',
  deleteBody:
    'Damit werden dein Pulse-Konto, deine restlichen Credits und dein Cloud-Backup dauerhaft gelöscht. Deine Einträge bleiben auf diesem Handy. Ein aktives Pulse Pro-Abo musst du in deinen Apple-ID-Einstellungen kündigen.',
  cancel: 'Abbrechen',
  deleteAccount: 'Konto löschen',
  deleting: 'Wird gelöscht…',
};

const fr: Partial<Record<keyof typeof en, string>> = {
  errorTitle: 'Un problème est survenu',
  tryAgain: 'Réessaie.',
  notSetUp: 'Les comptes ne sont pas encore configurés dans cette version.',
  signInPitch: 'Connecte-toi pour obtenir {credits}, en acheter plus et sauvegarder ta progression.',
  freeCredits: '50 crédits IA gratuits',
  appleUnavailable: 'Se connecter avec Apple n’est pas disponible sur cet appareil.',
  signedIn: 'CONNECTÉ',
  emailHidden: 'Identifiant Apple (e-mail masqué)',
  getMoreCredits: 'PLUS DE CRÉDITS',
  backUpNow: 'SAUVEGARDER',
  signOut: 'DÉCONNEXION',
  backedUpAt: 'Sauvegardé : {time}',
  autoBackup: 'Tes données sont sauvegardées automatiquement tant que tu es connecté.',
  deleteTitle: 'Supprimer ton compte ?',
  deleteBody:
    'Cela supprime définitivement ton compte Pulse, tes crédits restants et ta sauvegarde cloud. Tes enregistrements restent sur ce téléphone. Un abonnement Pulse Pro actif doit être résilié dans les réglages de ton identifiant Apple.',
  cancel: 'Annuler',
  deleteAccount: 'Supprimer le compte',
  deleting: 'Suppression…',
};

const it: Partial<Record<keyof typeof en, string>> = {
  errorTitle: 'Qualcosa è andato storto',
  tryAgain: 'Riprova.',
  notSetUp: 'Gli account non sono ancora configurati in questa build.',
  signInPitch: 'Accedi per avere {credits}, comprarne altri e fare il backup dei progressi.',
  freeCredits: '50 crediti IA gratis',
  appleUnavailable: 'Accedi con Apple non è disponibile su questo dispositivo.',
  signedIn: 'CONNESSO',
  emailHidden: 'ID Apple (email nascosta)',
  getMoreCredits: 'PRENDI PIÙ CREDITI',
  backUpNow: 'BACKUP ORA',
  signOut: 'ESCI',
  backedUpAt: 'Backup: {time}',
  autoBackup: 'I tuoi dati vanno in backup automaticamente finché hai fatto l’accesso.',
  deleteTitle: 'Eliminare l’account?',
  deleteBody:
    'Elimina per sempre il tuo account Pulse, i crediti rimasti e il backup nel cloud. Le tue registrazioni restano su questo telefono. Un abbonamento Pulse Pro attivo va annullato nelle impostazioni del tuo ID Apple.',
  cancel: 'Annulla',
  deleteAccount: 'Elimina account',
  deleting: 'Eliminazione…',
};

const pt: Partial<Record<keyof typeof en, string>> = {
  errorTitle: 'Algo deu errado',
  tryAgain: 'Tente de novo.',
  notSetUp: 'As contas ainda não estão configuradas nesta versão.',
  signInPitch: 'Entre para ganhar {credits}, comprar mais e fazer backup do seu progresso.',
  freeCredits: '50 créditos de IA grátis',
  appleUnavailable: 'Iniciar sessão com a Apple não está disponível neste aparelho.',
  signedIn: 'CONECTADO',
  emailHidden: 'ID Apple (e-mail oculto)',
  getMoreCredits: 'PEGAR MAIS CRÉDITOS',
  backUpNow: 'FAZER BACKUP',
  signOut: 'SAIR',
  backedUpAt: 'Backup feito: {time}',
  autoBackup: 'Seus dados têm backup automático enquanto você estiver conectado.',
  deleteTitle: 'Apagar sua conta?',
  deleteBody:
    'Isso apaga para sempre sua conta do Pulse, seus créditos restantes e seu backup na nuvem. Seus registros ficam neste celular. Uma assinatura ativa do Pulse Pro precisa ser cancelada nos ajustes do seu ID Apple.',
  cancel: 'Cancelar',
  deleteAccount: 'Apagar conta',
  deleting: 'Apagando…',
};

const strings: Record<'en' | 'es' | 'de' | 'fr' | 'it' | 'pt', Partial<Record<keyof typeof en, string>>> = { en, es, de, fr, it, pt };
export default strings;
