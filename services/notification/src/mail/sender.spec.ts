import { SendEmailCommand } from '@aws-sdk/client-sesv2';
import { SesMailSender, SmtpMailSender } from './sender';

const noRetry = { attempts: 1, delayMs: 0 };

describe('SesMailSender (staging-readiness F1)', () => {
  const setup = (retry = noRetry) => {
    const send = jest.fn().mockResolvedValue({ MessageId: 'm-1' });
    return { send, sender: new SesMailSender({ send } as never, 'no-reply@hr.example', retry) };
  };
  const input = (send: jest.Mock, i = 0) => (send.mock.calls[i][0] as SendEmailCommand).input;

  it('một người nhận: đặt ở To, nội dung UTF-8', async () => {
    const { send, sender } = setup();
    await sender.send({ to: ['a@x.vn'], subject: 'Đơn nghỉ', text: 'Nội dung' });
    expect(send).toHaveBeenCalledTimes(1);
    const cmd = input(send);
    expect(cmd.FromEmailAddress).toBe('no-reply@hr.example');
    expect(cmd.Destination).toEqual({ ToAddresses: ['a@x.vn'] });
    expect(cmd.Content?.Simple?.Subject).toEqual({ Data: 'Đơn nghỉ', Charset: 'UTF-8' });
    expect(cmd.Content?.Simple?.Body?.Text).toEqual({ Data: 'Nội dung', Charset: 'UTF-8' });
  });

  it('nhiều người nhận: đặt ở Bcc để không lộ địa chỉ của nhau (BR-15)', async () => {
    const { send, sender } = setup();
    await sender.send({ to: ['a@x.vn', 'b@x.vn'], subject: 's', text: 't' });
    expect(input(send).Destination).toEqual({ ToAddresses: ['no-reply@hr.example'], BccAddresses: ['a@x.vn', 'b@x.vn'] });
  });

  it('quá 49 người nhận thì chia lô (SES tối đa 50 địa chỉ mỗi email)', async () => {
    const { send, sender } = setup();
    await sender.send({ to: Array.from({ length: 100 }, (_, i) => `u${i}@x.vn`), subject: 's', text: 't' });
    expect(send).toHaveBeenCalledTimes(3);
    expect(input(send, 2).Destination?.BccAddresses).toHaveLength(2);
  });

  it('không có người nhận thì không gọi SES', async () => {
    const { send, sender } = setup();
    await sender.send({ to: [' '], subject: 's', text: 't' });
    expect(send).not.toHaveBeenCalled();
  });

  it('thử lại theo từng lô: lô 2 lỗi một lần thì chỉ gửi lại lô 2 (NFR-3.5)', async () => {
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const { send, sender } = setup({ attempts: 3, delayMs: 0 });
    send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Throttling')).mockResolvedValue({});
    await sender.send({ to: Array.from({ length: 60 }, (_, i) => `u${i}@x.vn`), subject: 's', text: 't' });
    expect(send).toHaveBeenCalledTimes(3);
    expect(input(send, 0).Destination?.BccAddresses?.[0]).toBe('u0@x.vn');
    expect(input(send, 1).Destination?.BccAddresses?.[0]).toBe('u49@x.vn');
    expect(input(send, 2).Destination?.BccAddresses?.[0]).toBe('u49@x.vn');
    jest.restoreAllMocks();
  });
});

describe('SmtpMailSender', () => {
  it('một người: To; nhiều người: Bcc, To là địa chỉ gửi', async () => {
    const sendMail = jest.fn().mockResolvedValue({});
    const sender = new SmtpMailSender({ sendMail } as never, 'no-reply@hr.local', noRetry);
    await sender.send({ to: ['a@x.vn'], subject: 's', text: 't' });
    await sender.send({ to: ['a@x.vn', 'b@x.vn'], subject: 's', text: 't' });
    expect(sendMail.mock.calls[0][0]).toEqual({ from: 'no-reply@hr.local', to: 'a@x.vn', subject: 's', text: 't' });
    expect(sendMail.mock.calls[1][0]).toEqual({ from: 'no-reply@hr.local', to: 'no-reply@hr.local', bcc: ['a@x.vn', 'b@x.vn'], subject: 's', text: 't' });
  });
});
