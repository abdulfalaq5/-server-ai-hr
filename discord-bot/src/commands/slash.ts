import { SlashCommandBuilder, CommandInteraction, ChatInputCommandInteraction } from 'discord.js';
import { StorageService } from '../services/storage.js';
import { config } from '../config.js';

export const slashCommandsList = [
  // /help
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Tampilkan panduan penggunaan bot dan daftar perintah yang tersedia.'),

  // /login <email>
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Hubungkan akun Discord Anda ke email yang terdaftar di whitelist.')
    .addStringOption(option =>
      option.setName('email')
        .setDescription('Alamat email Anda (harus ada di whitelist)')
        .setRequired(true)
    )
];

// Helper to check if user is allowed (whitelist validation)
function isUserAllowed(interaction: CommandInteraction): boolean {
  // We can default this to true because user email mapping validation happens afterward
  return true;
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const { commandName, user } = interaction;

  if (!isUserAllowed(interaction)) {
    return interaction.reply({ content: '🚫 Unauthorized access.', ephemeral: true });
  }

  // /login <email> is handled separately as it doesn't require prior login mapping
  if (commandName === 'login') {
    const email = interaction.options.getString('email', true).trim().toLowerCase();
    
    if (!config.emailWhitelist.includes(email)) {
      return interaction.reply({
        content: `❌ Maaf, email \`${email}\` tidak terdaftar dalam whitelist sistem. Hubungi administrator untuk menambahkan email Anda.`,
        ephemeral: true
      });
    }

    StorageService.setUserEmail(user.id, email, user.username);
    return interaction.reply({
      content: `✅ Akun Discord Anda berhasil terhubung dengan email \`${email}\`. Anda sekarang dapat bertanya di channel #hr-assistant atau via DM.`,
      ephemeral: true
    });
  }

  // For all other commands, verify user has mapped email
  const userEmail = StorageService.getUserEmail(user.id);
  if (!userEmail) {
    return interaction.reply({
      content: '❌ Silakan hubungkan email Anda terlebih dahulu menggunakan perintah: `/login <email_anda>`',
      ephemeral: true
    });
  }

  if (commandName === 'help') {
    const helpText = `### 🤖 **HR Assistant Bot - Panduan Perintah**
Gunakan bot ini untuk menanyakan aturan, hak, dan kebijakan perusahaan berdasarkan dokumen HR resmi:

• \`/login <email>\` - Hubungkan akun Discord Anda ke email whitelist.
• \`/help\` - Tampilkan panduan ini.

**Interaksi Chat:**
Silakan ajukan pertanyaan seputar ketenagakerjaan atau HR (misalnya cuti, keterlambatan, lembur, BPJS, THR) secara langsung:
1. Sebut (mention) bot ini di channel mana saja, atau
2. Kirim pesan langsung ke bot ini (DM), atau
3. Chat langsung di channel **#hr-assistant**.

*Catatan: Bot hanya dapat menjawab berdasarkan dokumen resmi perusahaan yang terunggah dan tidak akan mengarang jawaban.*`;
    
    return interaction.reply({ content: helpText });
  }

  return interaction.reply({ content: 'Unknown command.', ephemeral: true });
}
