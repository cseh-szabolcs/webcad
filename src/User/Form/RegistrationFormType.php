<?php

namespace App\User\Form;

use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\Extension\Core\Type\CheckboxType;
use Symfony\Component\Form\Extension\Core\Type\EmailType;
use Symfony\Component\Form\Extension\Core\Type\PasswordType;
use Symfony\Component\Form\Extension\Core\Type\RepeatedType;
use Symfony\Component\Form\Extension\Core\Type\TextType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\Validator\Constraints as Assert;

/**
 * Registers an office (the later tenant) with its first user. There is no User entity yet, so the
 * form works on an array; the labels are translation keys.
 */
final class RegistrationFormType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('company', TextType::class, [
                'label' => 'user.register.company',
                'attr' => ['autocomplete' => 'organization'],
                'constraints' => [new Assert\NotBlank(), new Assert\Length(max: 120)],
            ])
            ->add('name', TextType::class, [
                'label' => 'user.register.name',
                'attr' => ['autocomplete' => 'name'],
                'constraints' => [new Assert\NotBlank(), new Assert\Length(max: 120)],
            ])
            ->add('email', EmailType::class, [
                'label' => 'user.register.email',
                'attr' => ['autocomplete' => 'email'],
                'constraints' => [new Assert\NotBlank(), new Assert\Email(), new Assert\Length(max: 180)],
            ])
            ->add('plainPassword', RepeatedType::class, [
                'type' => PasswordType::class,
                'invalid_message' => 'user.register.password_mismatch',
                'first_options' => [
                    'label' => 'user.register.password',
                    'help' => 'user.register.password_help',
                    'attr' => ['autocomplete' => 'new-password'],
                ],
                'second_options' => [
                    'label' => 'user.register.password_repeat',
                    'attr' => ['autocomplete' => 'new-password'],
                ],
                'constraints' => [new Assert\NotBlank(), new Assert\Length(min: 12, max: 4096)],
            ])
            ->add('acceptTerms', CheckboxType::class, [
                'label' => 'user.register.accept_terms',
                'constraints' => [new Assert\IsTrue(message: 'user.register.accept_terms_required')],
            ]);
    }
}
